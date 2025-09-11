import type { Metadata } from "next";
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: "AI Marketing Blog - E-commerce Advertising Tips & Strategies | Flowtra",
  description: "Learn advanced AI marketing strategies, e-commerce advertising tips, and video creation techniques. Expert insights for Amazon and Walmart sellers.",
  keywords: [
    "AI marketing blog",
    "e-commerce advertising strategies", 
    "video marketing tips",
    "Amazon seller marketing",
    "product photography guide",
    "AI advertising trends",
    "conversion optimization"
  ],
  openGraph: {
    title: "AI Marketing Blog - Expert E-commerce Strategies",
    description: "Professional insights on AI-powered marketing, video advertising, and e-commerce growth strategies.",
    url: 'https://www.flowtra.store/blog',
  },
  alternates: {
    canonical: '/blog',
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
}
