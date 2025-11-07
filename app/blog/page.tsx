'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { type Article, calculateReadingTime, extractExcerpt } from '@/lib/supabase'
import SearchBar from '@/components/ui/SearchBar'
import Pagination from '@/components/ui/Pagination'
import ArticleCard from '@/components/ui/ArticleCard'
import BlogSidebar from '@/components/ui/BlogSidebar'

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

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    searchParams.get('platforms')?.split(',').filter(Boolean) || []
  )
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(
    searchParams.get('audiences')?.split(',').filter(Boolean) || []
  )
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10))

  // Data state
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({})
  const [audienceCounts, setAudienceCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', currentPage.toString())
      params.set('limit', '9')
      if (searchQuery) params.set('search', searchQuery)
      if (selectedPlatforms.length > 0) params.set('platforms', selectedPlatforms.join(','))
      if (selectedAudiences.length > 0) params.set('audiences', selectedAudiences.join(','))

      const response = await fetch(`/api/articles?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch articles')
      }

      const data: ArticlesResponse = await response.json()

      setArticles(data.articles)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPlatformCounts(data.platformCounts)
      setAudienceCounts(data.audienceCounts)
    } catch (err) {
      console.error('Error fetching articles:', err)
      setError('Failed to load articles. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, searchQuery, selectedPlatforms, selectedAudiences])

  // Fetch articles when filters change
  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('search', searchQuery)
    if (selectedPlatforms.length > 0) params.set('platforms', selectedPlatforms.join(','))
    if (selectedAudiences.length > 0) params.set('audiences', selectedAudiences.join(','))
    if (currentPage > 1) params.set('page', currentPage.toString())

    const newUrl = params.toString() ? `/blog?${params.toString()}` : '/blog'
    router.push(newUrl, { scroll: false })
  }, [searchQuery, selectedPlatforms, selectedAudiences, currentPage, router])

  // Handle search change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  // Handle platforms change
  const handlePlatformsChange = (platforms: string[]) => {
    setSelectedPlatforms(platforms)
    setCurrentPage(1)
  }

  // Handle audiences change
  const handleAudiencesChange = (audiences: string[]) => {
    setSelectedAudiences(audiences)
    setCurrentPage(1)
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <BlogSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        selectedPlatforms={selectedPlatforms}
        selectedAudiences={selectedAudiences}
        onPlatformsChange={handlePlatformsChange}
        onAudiencesChange={handleAudiencesChange}
        platformCounts={platformCounts}
        audienceCounts={audienceCounts}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
          {/* Header with hamburger */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#37352f] hover:bg-[#fafafa] rounded transition"
              aria-label="Open filters"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <div>
              <h1 className="text-4xl font-bold text-[#37352f] mb-2">
                Blog
              </h1>
              <p className="text-base text-[#787774]">
                Insights on AI video generation and marketing automation
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search articles..."
          />

          {/* Results Count */}
          {!isLoading && (
            <div className="text-sm text-[#787774]">
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
                  onClick={fetchArticles}
                  className="px-4 py-2 bg-[#37352f] text-white rounded text-sm hover:bg-[#2c2a26] transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && articles.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-[#f7f6f3] rounded-lg p-8 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-[#37352f] mb-2">
                  {searchQuery || selectedPlatforms.length > 0 || selectedAudiences.length > 0
                    ? 'No articles match your filters'
                    : 'No articles yet'
                  }
                </h3>
                <p className="text-sm text-[#787774]">
                  {searchQuery || selectedPlatforms.length > 0 || selectedAudiences.length > 0
                    ? 'Try different filters or clear your selection.'
                    : 'Check back later for new content.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Articles Grid */}
          {!isLoading && !error && articles.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="pt-4">
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
      </div>
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
