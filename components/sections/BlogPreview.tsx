'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { getAllArticles, calculateReadingTime, extractExcerpt } from '@/lib/supabase';

interface Article {
  id: string;
  title: string;
  slug: string;
  cover?: string | null;
  content: string;
  created_at: string;
}

export default function BlogPreview() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await getAllArticles();
        if (!mounted) return;
        setArticles((all || []).slice(0, 3));
      } catch {
        if (mounted) setArticles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section id="blog" className="py-16 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">From the Blog</h2>
            <p className="text-gray-600 mt-2">Latest tips and case studies about AI ads</p>
          </div>
          <Link href="/blog" className="text-gray-900 font-medium hover:underline whitespace-nowrap">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No articles yet</h3>
                  <p className="text-gray-600">Check back later for new AI marketing insights and guides.</p>
                </div>
              </div>
            ) : (
              articles.map((article) => {
                const publishDate = new Date(article.created_at);
                const readingTime = calculateReadingTime(article.content);
                const excerpt = extractExcerpt(article.content, 100);
                return (
                  <article key={article.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    {article.cover ? (
                      <Image
                        src={article.cover}
                        alt={article.title}
                        width={800}
                        height={600}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="h-44 bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No Image</span>
                      </div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {publishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {readingTime}
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-gray-700">
                        <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                      </h3>
                      <p className="text-gray-600 mb-3 line-clamp-2">{excerpt}</p>
                      <div className="mt-auto">
                        <Link href={`/blog/${article.slug}`} className="text-gray-900 font-medium hover:underline">
                          Read More →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

      </div>
    </section>
  );
}
