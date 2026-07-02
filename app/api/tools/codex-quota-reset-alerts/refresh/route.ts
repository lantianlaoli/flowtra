// POST /api/tools/codex-quota-reset-alerts/refresh
// Manual refresh for signed-in users. Re-fetches the latest X signals,
// merges them into the cache, and recomputes category on every row so the
// page filter can surface Codex-reset notices.

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  POST_WINDOW_DAYS,
  buildXRecentSearchQuery,
  classifyPost,
  containsCodexResetSignal,
  normalizeAndDedupeTweets,
  persistPosts,
} from '@/lib/tools/codex-quota-reset-alerts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const X_BEARER_TOKEN = () => process.env.X_BEARER_TOKEN ?? ''

async function fetchRecentTweets() {
  const bearer = X_BEARER_TOKEN()
  if (!bearer) return null
  const params = new URLSearchParams({
    query: buildXRecentSearchQuery(),
    max_results: '30',
    'tweet.fields': 'created_at,author_id,text,note_tweet',
    expansions: 'author_id',
    'user.fields': 'username,name,verified',
  })
  const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function reclassifyAllRows() {
  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('codex_quota_reset_posts')
    .select('id,full_text,excerpt')
  if (error || !rows) return { updated: 0, classified: 0 }
  let classified = 0
  let updated = 0
  for (const row of rows as Array<{ id: string; full_text: string | null; excerpt: string | null }>) {
    const text = (row.full_text || row.excerpt || '').trim()
    if (!text) continue
    const next = classifyPost(text)
    classified += 1
    if (next === 'codex_reset') {
      await supabase
        .from('codex_quota_reset_posts')
        .update({ category: next })
        .eq('id', row.id)
      updated += 1
    }
  }
  return { updated, classified }
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Re-fetch from X and merge into the cache (additive; no DELETE).
    const tweets = await fetchRecentTweets()
    const data = (tweets?.data as Array<Record<string, unknown>> | undefined) ?? []
    const includes = (tweets?.includes as { users?: Array<Record<string, unknown>> } | undefined) ?? {}

    let inserted = 0
    if (data.length > 0) {
      const normalized = normalizeAndDedupeTweets(
        data as unknown as Parameters<typeof normalizeAndDedupeTweets>[0],
        includes.users as unknown as Parameters<typeof normalizeAndDedupeTweets>[1]
      )
      if (normalized.length > 0) {
        const result = await persistPosts(normalized)
        if (!result.error) inserted = result.inserted
      }
    }

    // Re-classify every cached row using the current signal logic so the
    // Codex-reset category lights up across the existing corpus.
    const reclassify = await reclassifyAllRows()

    return NextResponse.json({
      success: true,
      summary: {
        fetched: data.length,
        inserted,
        reclassified: reclassify.classified,
        marked_codex_reset: reclassify.updated,
        window_days: POST_WINDOW_DAYS,
        reset_by: userId,
      },
    })
  } catch (error) {
    console.error('[codex-quota-reset-alerts] refresh failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 }
    )
  }
}
