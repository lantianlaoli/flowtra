'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Article } from '@/lib/supabase'

interface ArticleCardProps {
  article: Article
  excerpt: string
  readTime: string
}

export default function ArticleCard({ article, excerpt, readTime }: ArticleCardProps) {
  // Format date
  const formattedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Link href={`/blog/${article.slug}`} className="group block">
      <article className="h-full rounded-lg border border-[#e5e7eb] bg-white overflow-hidden transition-all duration-150 hover:bg-[#fafafa] hover:shadow-sm">
        {/* Cover Image */}
        {article.cover && (
          <div className="relative aspect-video overflow-hidden bg-[#f7f6f3]">
            <Image
              src={article.cover}
              alt={article.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        )}

        {/* Card Content */}
        <div className="p-6 space-y-3">
          {/* Title */}
          <h3 className="text-lg font-semibold text-[#37352f] line-clamp-2 leading-snug">
            {article.title}
          </h3>

          {/* Excerpt */}
          <p className="text-sm text-[#787774] line-clamp-3 leading-relaxed">
            {excerpt}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-[#9b9a97] pt-1">
            <time dateTime={article.created_at}>{formattedDate}</time>
            <span>·</span>
            <span>{readTime}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
