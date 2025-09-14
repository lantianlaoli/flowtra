import type { Metadata } from "next";
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: "Small Business AI Marketing Blog | Video Ad Tips for Etsy & Amazon Sellers",
  description: "Practical AI marketing guides for small businesses, Etsy sellers, and craft makers. Learn to create video ads under $1 and grow your handmade business.",
  keywords: [
    "small business marketing blog",
    "Etsy seller marketing tips",
    "craft business advertising",
    "handmade product video ads",
    "small retailer AI tools",
    "under $1 video marketing",
    "makers and creators blog",
    "Amazon seller marketing",
    "video marketing tips",
    "AI advertising for small business"
  ],
  openGraph: {
    title: "Small Business AI Marketing Blog | Etsy & Amazon Seller Tips",
    description: "Practical AI marketing guides for small businesses, Etsy sellers, and craft makers. Create video ads under $1.",
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
