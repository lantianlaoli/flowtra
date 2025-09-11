import Link from 'next/link';
import Image from 'next/image';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { getAllArticles, calculateReadingTime, extractExcerpt } from '@/lib/supabase';

// Revalidate the blog index periodically to pick up new posts
export const revalidate = 60; // seconds

function truncate(text: string, max: number) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

export default async function BlogPage() {
  // Get articles from database
  const articles = await getAllArticles();
  return (
    <div>
      {/* Blog Header */}
      <header className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          AI Ad Generation for Small Businesses
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Practical guides, tips, and case studies on AI-powered advertising for small businesses.
        </p>
      </header>

      {/* Blog Posts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-50 rounded-lg p-8">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No articles yet</h3>
              <p className="text-gray-600">Check back later for new AI marketing insights and guides.</p>
            </div>
          </div>
        ) : (
          articles.map((article) => {
            const publishDate = new Date(article.created_at);
            const readingTime = calculateReadingTime(article.content);
            const rawExcerpt = extractExcerpt(article.content, 110);
            const excerpt = truncate(rawExcerpt, 120);
            const title = truncate(article.title, 70);
            
            return (
              <article key={article.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {article.cover ? (
                  <Image
                    src={article.cover}
                    alt={article.title}
                    width={800}
                    height={600}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="h-48 bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No Image</span>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {publishDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      {readingTime}
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-gray-700">
                    <Link href={`/blog/${article.slug}`}>
                      {title}
                    </Link>
                  </h2>

                  <p className="text-gray-600 mb-4 leading-relaxed flex-1">
                    {excerpt}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>By Flowtra Team</span>
                    </div>
                    <Link 
                      href={`/blog/${article.slug}`}
                      className="text-gray-900 font-medium hover:underline"
                    >
                      Read More →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

    </div>
  );
}
