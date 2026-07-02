// GET /api/tools/codex-quota-reset-alerts/posts
// Returns persisted reset posts from the last 30 days. Public endpoint.

import { NextResponse } from 'next/server'
import {
  fetchRecentPosts,
  filterRecentPosts,
  refreshCodexResetPosts,
} from '@/lib/tools/codex-quota-reset-alerts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    let posts = await fetchRecentPosts()
    let refresh: Awaited<ReturnType<typeof refreshCodexResetPosts>> | null = null
    if (posts.length === 0) {
      refresh = await refreshCodexResetPosts()
      if (!refresh.error && refresh.inserted > 0) {
        posts = await fetchRecentPosts()
      }
    }

    const recent = filterRecentPosts(posts)
    return NextResponse.json({
      success: true,
      posts: recent,
      count: recent.length,
      window_days: 30,
      refresh,
    })
  } catch (error) {
    console.error('[codex-quota-reset-alerts] GET /posts failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load reset posts' },
      { status: 500 }
    )
  }
}
