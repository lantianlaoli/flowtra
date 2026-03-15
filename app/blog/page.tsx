'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type Article } from '@/lib/supabase'
import { calculateReadingTime, extractExcerpt } from '@/lib/article-utils'
import SearchBar from '@/components/ui/SearchBar'
import Pagination from '@/components/ui/Pagination'
import ArticleCard from '@/components/ui/ArticleCard'

interface ArticlesResponse {
  articles: Article[]
  total: number
  page: number
  limit: number
  totalPages: number
  platformCounts: Record<string, number>
  audienceCounts: Record<string, number>
}

function BlogPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Data state
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use ref to track abort controller for canceling stale requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch articles when URL params change
  useEffect(() => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const fetchArticles = async () => {
      setIsLoading(true)
      setError(null)

      const currentPage = searchParams.get('page') || '1'
      const searchQuery = searchParams.get('search') || ''

      const pageNum = parseInt(currentPage, 10)

      try {
        const params = new URLSearchParams()
        params.set('page', pageNum.toString())
        params.set('limit', '9')
        if (searchQuery) params.set('search', searchQuery)

        const response = await fetch(`/api/articles?${params.toString()}`, {
          signal: abortControllerRef.current?.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to fetch articles')
        }

        const data: ArticlesResponse = await response.json()

        setArticles(data.articles)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Error fetching articles:', err)
        setError('Failed to load articles. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()

    // Cleanup function to abort on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [searchParams]) // Depend on searchParams to re-run when URL changes

  // Derived values for rendering - computed directly without useMemo
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const searchQuery = searchParams.get('search') || ''
  const hasActiveFilters = Boolean(searchQuery)

  // Retry function for error state
  const retryFetch = () => {
    setError(null)
    setIsLoading(true)
    // Force a re-render by refreshing the router
    router.refresh()
  }

  // Handle search change
  const handleSearchChange = useCallback((value: string) => {
    const params = new URLSearchParams(window.location.search)
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }
    params.set('page', '1') // Reset to page 1

    const newUrl = params.toString() ? `/blog?${params.toString()}` : '/blog'
    router.push(newUrl, { scroll: false })
  }, [router])

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(window.location.search)
    // Always set page parameter (including page 1) to maintain URL consistency
    params.set('page', page.toString())

    const newUrl = `/blog?${params.toString()}`
    router.push(newUrl, { scroll: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [router])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-[#37352f]">
          Blog
        </h1>
        <p className="text-lg text-[#787774]">
          Insights on AI video generation and marketing automation
        </p>
      </div>

      {/* Search Bar - Centered */}
      <div className="max-w-xl mx-auto w-full">
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search articles..."
        />
      </div>

      {/* Results Count */}
      {!isLoading && (
        <div className="text-sm text-[#787774] text-center">
          {total === 0 ? (
            'No articles found'
          ) : (
            <span>
              {total} {total === 1 ? 'article' : 'articles'}
            </span>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-16">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-32 bg-[#f7f6f3] rounded mx-auto"></div>
            <div className="h-4 w-48 bg-[#f7f6f3] rounded mx-auto"></div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-16">
          <div className="bg-[#f7f6f3] rounded-lg p-8 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-[#37352f] mb-2">Error</h3>
            <p className="text-sm text-[#787774] mb-4">{error}</p>
            <button
              onClick={retryFetch}
              className="px-4 py-2 bg-[#37352f] text-white rounded text-sm hover:bg-[#2c2a26] transition"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && articles.length === 0 && (
        hasActiveFilters ? (
          <div className="text-center py-16">
            <div className="bg-[#f7f6f3] rounded-lg p-8 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-[#37352f] mb-2">
                No articles match your search
              </h3>
              <p className="text-sm text-[#787774]">
                Try different keywords or clear your search.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((index) => (
                <div key={index} className="p-6 border border-[#f0efeb] rounded-2xl bg-[#f7f6f3] animate-pulse space-y-4">
                  <div className="h-40 bg-white/60 rounded-xl" />
                  <div className="h-4 bg-white/70 rounded w-2/3" />
                  <div className="h-4 bg-white/70 rounded w-1/2" />
                  <div className="h-4 bg-white/60 rounded w-full" />
                  <div className="h-4 bg-white/60 rounded w-5/6" />
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[#787774] mt-8">
              Loading articles…
            </p>
          </div>
        )
      )}

      {/* Articles Grid */}
      {!isLoading && !error && articles.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => {
              const readingTime = calculateReadingTime(article.content)
              const excerpt = extractExcerpt(article.content, 160)

              return (
                <ArticleCard
                  key={article.id}
                  article={article}
                  excerpt={excerpt}
                  readTime={readingTime}
                />
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function BlogPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-white items-center justify-center">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-32 bg-[#f7f6f3] rounded mx-auto"></div>
          <div className="h-4 w-48 bg-[#f7f6f3] rounded mx-auto"></div>
        </div>
      </div>
    }>
      <BlogPageContent />
    </Suspense>
  )
}
