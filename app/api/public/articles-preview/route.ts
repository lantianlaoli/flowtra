import { NextResponse } from 'next/server'
import { calculateReadingTime, extractExcerpt, type ArticlePreview } from '@/lib/article-utils'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ArticlePreviewRow {
  id: string
  title: string
  slug: string
  content: string
  created_at: string | null
  cover: string | null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limitParam = parseInt(url.searchParams.get('limit') ?? '3', 10)
    const limit = Number.isNaN(limitParam) ? 3 : Math.min(Math.max(limitParam, 1), 6)

    const supabase = getSupabaseAdmin()

    // Schema verified via Supabase MCP (2026-03-14):
    // public.articles has id, title, slug, content, created_at, and nullable cover.
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, content, created_at, cover')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[GET /api/public/articles-preview] Failed to fetch article previews:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch article previews' },
        { status: 500 }
      )
    }

    const articles: ArticlePreview[] = ((data ?? []) as ArticlePreviewRow[]).map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug.trim(),
      cover: article.cover,
      created_at: article.created_at ?? new Date(0).toISOString(),
      excerpt: extractExcerpt(article.content, 100),
      readingTime: calculateReadingTime(article.content),
    }))

    return NextResponse.json({ success: true, articles })
  } catch (error) {
    console.error('[GET /api/public/articles-preview] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
