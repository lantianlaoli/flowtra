'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { ArticlePreview } from '@/lib/article-utils';
import { useI18n } from '@/providers/I18nProvider';

interface ArticlesPreviewResponse {
  success: boolean;
  articles: ArticlePreview[];
}

export default function BlogPreview() {
  const { locale, messages } = useI18n();
  const blogMessages = messages.landing.blogPreview;
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
          throw new Error(blogMessages.fetchFailed);
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
  }, [blogMessages.fetchFailed]);

  return (
    <section id="blog" className="landing-section-surface py-14 md:py-16 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-8">
          <div>
            <h2 className="text-[32px] md:text-[40px] font-bold tracking-tight text-black">{blogMessages.title}</h2>
            <p className="text-[#666666] text-base md:text-lg mt-2">{blogMessages.description}</p>
          </div>
          <Link
            href="/blog"
            className="landing-press-button landing-press-button--secondary landing-press-button--compact whitespace-nowrap text-[14px] font-semibold"
          >
            {blogMessages.viewAll}
          </Link>
        </div>

        {(loading || articles.length === 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((index) => (
              <div key={index} className="landing-info-card border border-[#E5E5E5] rounded-[24px] p-5 sm:p-6 animate-pulse space-y-4">
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
                <article key={article.id} className="landing-info-card flex flex-col overflow-hidden rounded-[24px] border border-[#E5E5E5] shadow-sm transition-shadow hover:shadow-md">
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
                      <span className="text-[#666666] text-sm">{blogMessages.noImage}</span>
                    </div>
                  )}
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666666] mb-2">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {publishDate.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
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
                      <Link
                        href={`/blog/${article.slug}`}
                        className="landing-press-button landing-press-button--secondary landing-press-button--compact text-[14px] font-semibold"
                      >
                        {blogMessages.readMore}
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
