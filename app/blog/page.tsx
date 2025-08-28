import Link from 'next/link';
import Image from 'next/image';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { getAllArticles, calculateReadingTime, extractExcerpt } from '@/lib/supabase';

export default async function BlogPage() {
  // Get articles from database
  const articles = await getAllArticles();
  return (
    <div>
      {/* Blog Header */}
      <header className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          AI Marketing Blog
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Expert insights on AI-powered e-commerce marketing, video advertising strategies, and conversion optimization techniques.
        </p>
      </header>

      {/* Blog Posts Grid */}
      <div className="grid grid-cols-1 gap-8 mb-12">
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
            const excerpt = extractExcerpt(article.content);
            
            return (
              <article key={article.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="md:flex">
                  <div className="md:flex-shrink-0 md:w-64">
                    {article.cover ? (
                      <Image
                        src={article.cover}
                        alt={article.title}
                        width={256}
                        height={192}
                        className="h-48 md:h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-48 md:h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No Image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-8 md:flex-1">
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-medium">
                        AI Marketing
                      </span>
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
                        {article.title}
                      </Link>
                    </h2>
                    
                    <p className="text-gray-600 mb-4 leading-relaxed">
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
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Newsletter Signup */}
      <section className="bg-gray-50 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Stay Updated with AI Marketing Insights
        </h2>
        <p className="text-gray-600 mb-6">
          Get the latest strategies, case studies, and AI marketing tips delivered to your inbox weekly.
        </p>
        <div className="max-w-md mx-auto flex gap-4">
          <input 
            type="email" 
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <button className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            Subscribe
          </button>
        </div>
      </section>
    </div>
  );
}