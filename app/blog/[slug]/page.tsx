import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import { Metadata } from 'next';
import { getArticleBySlug, getAllArticles, calculateReadingTime, extractExcerpt } from '@/lib/supabase';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  
  // Get article from database
  const article = await getArticleBySlug(slug);
  
  if (!article) {
    notFound();
  }
  
  const readingTime = calculateReadingTime(article.content);
  const publishDate = new Date(article.created_at);

  return (
    <div className="min-h-screen bg-white">
      {/* Header with back navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link 
          href="/blog"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Link>
      </div>

      {/* Article Header */}
      <header className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-6">
          {article.title}
        </h1>
        
        <div className="flex items-center gap-6 text-sm text-gray-500 mb-8">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <time dateTime={article.created_at}>
              {publishDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {readingTime}
          </div>
        </div>

        {/* Cover Image */}
        {article.cover && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <Image
              src={article.cover}
              alt={article.title}
              width={896}
              height={672}
              className="w-full h-auto object-cover aspect-[4/3]"
              priority
            />
          </div>
        )}
      </header>

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <article className="prose prose-lg prose-gray max-w-none">
          <MarkdownRenderer content={article.content} />
        </article>

        {/* Article Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <Link 
              href="/blog"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to all articles
            </Link>
            
            <div className="text-sm text-gray-500">
              Published on {publishDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const article = await getArticleBySlug(slug);
  
  if (!article) {
    return {
      title: 'Article Not Found | Flowtra Blog',
      description: 'The requested article could not be found.'
    };
  }

  const excerpt = extractExcerpt(article.content, 160);
  
  return {
    title: `${article.title} | Flowtra Blog`,
    description: excerpt,
    keywords: [
      'AI marketing',
      'video advertising',
      'e-commerce',
      'product marketing',
      'AI-powered ads',
      'Amazon advertising',
      'Walmart marketplace'
    ],
    authors: [{ name: 'Flowtra Team' }],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: article.title,
      description: excerpt,
      url: `/blog/${slug}`,
      siteName: 'Flowtra',
      images: [
        {
          url: '/opengraph-image.jpg',
          width: 1200,
          height: 630,
          alt: `${article.title} - Flowtra Blog`,
        },
      ],
      locale: 'en_US',
      type: 'article',
      publishedTime: article.created_at,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: excerpt,
      images: ['/twitter-image.jpg'],
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  // Get articles from database for static generation
  const articles = await getAllArticles();
  
  return articles.map(article => ({
    slug: article.slug
  }));
}