import dynamic from 'next/dynamic';
import DemoVideoSchema from '@/components/seo/DemoVideoSchema';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { demoVideos } from '@/lib/landing-data';
import HeroSection from '@/components/pages/landing/sections/HeroSection';
import { SectionViewTracker } from '@/components/analytics/SectionViewTracker';

import FeaturesSection from '@/components/pages/landing/sections/FeaturesSection';
import WhyFlowtraSection from '@/components/pages/landing/sections/WhyFlowtraSection';
import LiteTrialCtaSection from '@/components/pages/landing/sections/LiteTrialCtaSection';

const FAQ = dynamic(() => import('@/components/sections/FAQ'), {
  loading: () => <div className="py-12" aria-hidden="true" />
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
        <SectionViewTracker section="hero" />
        <HeroSection />



        {/* Features Section */}
        <SectionViewTracker section="features" />
        <FeaturesSection />

        {/* Why Flowtra Section */}
        <SectionViewTracker section="why_flowtra" />
        <WhyFlowtraSection />
      </main>

      {/* FAQ Section */}
      <SectionViewTracker section="faq" />
      <FAQ />

      {/* Lite Trial CTA Section */}
      <SectionViewTracker section="lite_trial_cta" />
      <LiteTrialCtaSection />

      <Footer />
    </div>
  );
}
