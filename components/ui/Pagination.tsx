'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showEllipsisStart = currentPage > 3
    const showEllipsisEnd = currentPage < totalPages - 2

    // Always show first page
    pages.push(1)

    // Show ellipsis or pages near start
    if (showEllipsisStart) {
      pages.push('...')
    } else if (totalPages > 1) {
      for (let i = 2; i <= Math.min(3, totalPages - 1); i++) {
        pages.push(i)
      }
    }

    // Show current page and neighbors (if not already shown)
    if (currentPage > 3 && currentPage < totalPages - 2) {
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i)
        }
      }
    }

    // Show ellipsis or pages near end
    if (showEllipsisEnd) {
      pages.push('...')
    } else if (totalPages > 3) {
      for (let i = Math.max(totalPages - 2, 4); i < totalPages; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }
    }

    // Always show last page
    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex items-center justify-center gap-1">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirstPage}
        className={`
          flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
          ${isFirstPage
            ? 'text-[#9b9a97] cursor-not-allowed'
            : 'text-[#37352f] hover:bg-[#f7f6f3]'
          }
        `}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-[#9b9a97] text-sm"
              >
                ...
              </span>
            )
          }

          const pageNum = page as number
          const isActive = pageNum === currentPage

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`
                min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-[#37352f] text-white'
                  : 'text-[#37352f] hover:bg-[#f7f6f3]'
                }
              `}
              aria-label={`Go to page ${pageNum}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {pageNum}
            </button>
          )
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLastPage}
        className={`
          flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
          ${isLastPage
            ? 'text-[#9b9a97] cursor-not-allowed'
            : 'text-[#37352f] hover:bg-[#f7f6f3]'
          }
        `}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
