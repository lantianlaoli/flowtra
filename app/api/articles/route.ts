import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, type Article } from '@/lib/supabase'
import { getMatchingCategories } from '@/lib/blog-categories'

export const dynamic = 'force-dynamic'

interface ArticlesResponse {
  articles: Article[]
  total: number
  page: number
  limit: number
  totalPages: number
  platformCounts: Record<string, number>
  audienceCounts: Record<string, number>
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const search = searchParams.get('search') || ''
    const platformsParam = searchParams.get('platforms') || ''
    const audiencesParam = searchParams.get('audiences') || ''

    const selectedPlatforms = platformsParam
      ? platformsParam.split(',').map(k => k.trim()).filter(Boolean)
      : []
    const selectedAudiences = audiencesParam
      ? audiencesParam.split(',').map(k => k.trim()).filter(Boolean)
      : []

    const supabase = getSupabase()

    // Build query for articles
    let articlesQuery = supabase
      .from('articles')
      .select('*', { count: 'exact' })

    // Apply search filter (title)
    if (search) {
      articlesQuery = articlesQuery.ilike('title', `%${search}%`)
    }

    // Apply category filters using keyword matching
    // We need to fetch all articles first, then filter by category matching on the server
    // This is because Supabase doesn't support complex array operations in a single query

    const { data: allArticles, error: articlesError } = await articlesQuery
      .order('created_at', { ascending: false })

    if (articlesError) {
      console.error('[GET /api/articles] Error fetching articles:', articlesError)
      return NextResponse.json(
        { error: 'Failed to fetch articles' },
        { status: 500 }
      )
    }

    // Filter articles by categories
    let filteredArticles = allArticles || []

    if (selectedPlatforms.length > 0 || selectedAudiences.length > 0) {
      filteredArticles = filteredArticles.filter(article => {
        if (!article.keywords) return false

        const { platforms, audiences } = getMatchingCategories(article.keywords)

        const matchesPlatform = selectedPlatforms.length === 0 ||
          selectedPlatforms.some(p => platforms.includes(p))

        const matchesAudience = selectedAudiences.length === 0 ||
          selectedAudiences.some(a => audiences.includes(a))

        return matchesPlatform && matchesAudience
      })
    }

    // Calculate counts for each category (for the sidebar)
    const platformCounts: Record<string, number> = {}
    const audienceCounts: Record<string, number> = {}

    filteredArticles.forEach(article => {
      if (!article.keywords) return

      const { platforms, audiences } = getMatchingCategories(article.keywords)

      platforms.forEach(platform => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1
      })

      audiences.forEach(audience => {
        audienceCounts[audience] = (audienceCounts[audience] || 0) + 1
      })
    })

    // Apply pagination
    const total = filteredArticles.length
    const totalPages = Math.ceil(total / limit)
    const from = (page - 1) * limit
    const to = from + limit
    const paginatedArticles = filteredArticles.slice(from, to)

    const response: ArticlesResponse = {
      articles: paginatedArticles.map(article => ({
        ...article,
        slug: article.slug.trim()
      })),
      total,
      page,
      limit,
      totalPages,
      platformCounts,
      audienceCounts
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[GET /api/articles] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
