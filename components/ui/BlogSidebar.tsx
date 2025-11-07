'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { PLATFORM_CATEGORIES, AUDIENCE_CATEGORIES, type CategoryDefinition } from '@/lib/blog-categories'

interface BlogSidebarProps {
  isOpen: boolean
  onClose: () => void
  selectedPlatforms: string[]
  selectedAudiences: string[]
  onPlatformsChange: (platforms: string[]) => void
  onAudiencesChange: (audiences: string[]) => void
  platformCounts?: Record<string, number>
  audienceCounts?: Record<string, number>
}

export default function BlogSidebar({
  isOpen,
  onClose,
  selectedPlatforms,
  selectedAudiences,
  onPlatformsChange,
  onAudiencesChange,
  platformCounts = {},
  audienceCounts = {}
}: BlogSidebarProps) {
  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onPlatformsChange(selectedPlatforms.filter(p => p !== platformId))
    } else {
      onPlatformsChange([...selectedPlatforms, platformId])
    }
  }

  const toggleAudience = (audienceId: string) => {
    if (selectedAudiences.includes(audienceId)) {
      onAudiencesChange(selectedAudiences.filter(a => a !== audienceId))
    } else {
      onAudiencesChange([...selectedAudiences, audienceId])
    }
  }

  const clearAll = () => {
    onPlatformsChange([])
    onAudiencesChange([])
  }

  const hasFilters = selectedPlatforms.length > 0 || selectedAudiences.length > 0

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 lg:top-20 left-0
          h-screen lg:h-[calc(100vh-5rem)]
          w-64 bg-white border-r border-[#e5e7eb]
          z-50 lg:z-0 transition-transform duration-300
          overflow-y-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6 space-y-6">
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 text-[#787774] hover:text-[#37352f]"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          {/* Header */}
          <div>
            <h2 className="text-sm font-semibold text-[#37352f] mb-1">Filters</h2>
            {hasFilters && (
              <button
                onClick={clearAll}
                className="text-xs text-[#2383e2] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Platform Section */}
          <div>
            <h3 className="text-xs font-medium text-[#787774] uppercase tracking-wider mb-3">
              Platform
            </h3>
            <div className="space-y-1">
              {PLATFORM_CATEGORIES.map((platform) => (
                <CategoryCheckbox
                  key={platform.id}
                  category={platform}
                  checked={selectedPlatforms.includes(platform.id)}
                  onChange={() => togglePlatform(platform.id)}
                  count={platformCounts[platform.id]}
                />
              ))}
            </div>
          </div>

          {/* Audience Section */}
          <div>
            <h3 className="text-xs font-medium text-[#787774] uppercase tracking-wider mb-3">
              Audience
            </h3>
            <div className="space-y-1">
              {AUDIENCE_CATEGORIES.map((audience) => (
                <CategoryCheckbox
                  key={audience.id}
                  category={audience}
                  checked={selectedAudiences.includes(audience.id)}
                  onChange={() => toggleAudience(audience.id)}
                  count={audienceCounts[audience.id]}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// Checkbox component for categories
function CategoryCheckbox({
  category,
  checked,
  onChange,
  count
}: {
  category: CategoryDefinition
  checked: boolean
  onChange: () => void
  count?: number
}) {
  return (
    <label
      className={`
        flex items-center justify-between px-2 py-1.5 rounded
        cursor-pointer transition-colors
        ${checked
          ? 'bg-[#e3e2e0] text-[#37352f]'
          : 'text-[#37352f] hover:bg-[#fafafa]'
        }
      `}
    >
      <div className="flex items-center gap-2 flex-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="
            w-4 h-4 rounded border-[#e5e7eb]
            text-[#2383e2] focus:ring-[#2383e2] focus:ring-offset-0
            cursor-pointer
          "
        />
        <span className="text-sm">{category.label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-[#9b9a97] ml-2">
          {count}
        </span>
      )}
    </label>
  )
}
