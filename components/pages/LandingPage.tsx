import dynamic from 'next/dynamic';
import DemoVideoSchema from '@/components/seo/DemoVideoSchema';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { demoVideos } from '@/lib/landing-data';
import HeroSection from '@/components/pages/landing/sections/HeroSection';

import FeaturesSection from '@/components/pages/landing/sections/FeaturesSection';
import ComparisonSection from '@/components/pages/landing/sections/ComparisonSection';
import ModelPricingSection from '@/components/pages/landing/sections/ModelPricingSection';
import PricingSection from '@/components/pages/landing/sections/PricingSection';

const FAQ = dynamic(() => import('@/components/sections/FAQ'), {
  loading: () => <div className="py-12 flex justify-center"><div className="text-gray-400">Loading...</div></div>
});
const BlogPreview = dynamic(() => import('@/components/sections/BlogPreview'), {
  loading: () => (
    <section id="blog" className="py-14 md:py-16 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((index) => (
            <div key={index} className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-5 sm:p-6 animate-pulse space-y-4">
              <div className="h-44 w-full bg-white/70 rounded-lg" />
              <div className="h-4 bg-white/80 rounded w-2/3" />
              <div className="h-4 bg-white/70 rounded w-1/2" />
              <div className="h-4 bg-white/60 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* SEO Schema for demo videos */}
      {demoVideos.map((video) => (
        <DemoVideoSchema
          key={video.videoUrl}
          videoUrl={video.videoUrl}
          title={video.title}
          description={video.description}
        />
      ))}

      <Header />

      {/* Hero Section */}
      <main className="mx-auto max-w-[90rem] px-4 pt-2 sm:px-6 sm:pt-3 lg:px-8">
        <HeroSection />



        {/* Features Section */}
        <FeaturesSection />

        {/* Comparison Section */}
        <ComparisonSection />

        {/* Model Pricing Section */}
        <ModelPricingSection />

        {/* Pricing Section */}
        <PricingSection />
      </main>

      {/* Blog Preview Section */}
      <BlogPreview />

      {/* FAQ Section */}
      <FAQ />

      <Footer />
    </div>
  );
}
