'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { ArticlePreview } from '@/lib/article-utils';

interface ArticlesPreviewResponse {
  success: boolean;
  articles: ArticlePreview[];
}

export default function BlogPreview() {
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/public/articles-preview?limit=3', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch article previews');
        }
        const data = (await response.json()) as ArticlesPreviewResponse;
        if (!mounted) return;
        setArticles(data.success ? data.articles : []);
      } catch {
        if (mounted) setArticles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section id="blog" className="py-14 md:py-16 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-8">
          <div>
            <h2 className="text-[32px] md:text-[40px] font-bold tracking-tight text-black">From the Blog</h2>
            <p className="text-[#666666] text-base md:text-lg mt-2">Latest tips and case studies about AI ads</p>
          </div>
          <Link href="/blog" className="text-black text-[14px] font-semibold hover:underline whitespace-nowrap">
            View all →
          </Link>
        </div>

        {(loading || articles.length === 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((index) => (
              <div key={index} className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-5 sm:p-6 animate-pulse space-y-4">
                <div className="h-44 w-full bg-white/70 rounded-lg" />
                <div className="h-4 bg-white/80 rounded w-2/3" />
                <div className="h-4 bg-white/70 rounded w-1/2" />
                <div className="h-4 bg-white/60 rounded w-full" />
                <div className="h-4 bg-white/60 rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => {
              const publishDate = new Date(article.created_at);
              return (
                <article key={article.id} className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  {article.cover ? (
                    <Image
                      src={article.cover}
                      alt={article.title}
                      width={800}
                      height={600}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="h-44 bg-[#F7F7F7] flex items-center justify-center">
                      <span className="text-[#666666] text-sm">No Image</span>
                    </div>
                  )}
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666666] mb-2">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {publishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {article.readingTime}
                      </div>
                    </div>
                    <h3 className="text-[20px] font-semibold text-black mb-2 hover:text-[#333333]">
                      <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                    </h3>
                    <p className="text-[#666666] text-[15px] mb-3 line-clamp-2 leading-relaxed">{article.excerpt}</p>
                    <div className="mt-auto">
                      <Link href={`/blog/${article.slug}`} className="text-black text-[14px] font-semibold hover:underline">
                        Read More →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
