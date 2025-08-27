import Link from 'next/link';
import { CalendarIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';

// This would typically come from a CMS or database
const blogPosts = [
  {
    slug: 'ai-video-marketing-amazon-2024',
    title: '10 AI Video Marketing Strategies for Amazon Sellers in 2024',
    excerpt: 'Discover how AI-generated video advertisements can boost your Amazon product sales with these proven strategies and best practices.',
    publishDate: '2024-01-15',
    readTime: '8 min read',
    author: 'Sarah Chen',
    category: 'Amazon Marketing',
    image: '/blog/ai-video-amazon.jpg'
  },
  {
    slug: 'product-photography-ai-enhancement',
    title: 'How AI Enhances Product Photography for E-commerce Success', 
    excerpt: 'Learn how artificial intelligence can transform your basic product photos into compelling marketing materials that drive conversions.',
    publishDate: '2024-01-10',
    readTime: '6 min read',
    author: 'Mike Rodriguez',
    category: 'Product Photography',
    image: '/blog/ai-product-photo.jpg'
  },
  {
    slug: 'walmart-advertising-ai-tools-2024',
    title: 'Walmart Marketplace: Leveraging AI Tools for Better Ad Performance',
    excerpt: 'Comprehensive guide to using AI-powered advertising tools to increase visibility and sales on Walmart Marketplace.',
    publishDate: '2024-01-05', 
    readTime: '10 min read',
    author: 'Jennifer Park',
    category: 'Walmart Marketing',
    image: '/blog/walmart-ai-ads.jpg'
  }
];

export default function BlogPage() {
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
        {blogPosts.map((post, index) => (
          <article key={index} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="md:flex">
              <div className="md:flex-shrink-0 md:w-48">
                <div className="h-48 md:h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Blog Image</span>
                </div>
              </div>
              <div className="p-8 md:flex-1">
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  <span className="bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-medium">
                    {post.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    {new Date(post.publishDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {post.readTime}
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-gray-700">
                  <Link href={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                
                <p className="text-gray-600 mb-4 leading-relaxed">
                  {post.excerpt}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <UserIcon className="w-4 h-4" />
                    {post.author}
                  </div>
                  <Link 
                    href={`/blog/${post.slug}`}
                    className="text-gray-900 font-medium hover:underline"
                  >
                    Read More →
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
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