import dynamic from 'next/dynamic';
import DemoVideoSchema from '@/components/seo/DemoVideoSchema';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BlogPreview from '@/components/sections/BlogPreview';
import { getActivatedUserCount } from '@/lib/publicMetrics';
import { demoVideos } from '@/lib/landing-data';
import HeroSection from '@/components/pages/landing/sections/HeroSection';
import SuccessStoriesSection from '@/components/pages/landing/sections/SuccessStoriesSection';
import FeaturesSection from '@/components/pages/landing/sections/FeaturesSection';
import ComparisonSection from '@/components/pages/landing/sections/ComparisonSection';
import ModelPricingSection from '@/components/pages/landing/sections/ModelPricingSection';
import PricingSection from '@/components/pages/landing/sections/PricingSection';

const FAQ = dynamic(() => import('@/components/sections/FAQ'), {
  loading: () => <div className="py-12 flex justify-center"><div className="text-gray-400">Loading...</div></div>
});

export default async function LandingPage() {
  const activatedUserCount = await getActivatedUserCount();

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
      <main className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <HeroSection activatedUserCount={activatedUserCount} />

        {/* Success Stories Section */}
        <SuccessStoriesSection />

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
