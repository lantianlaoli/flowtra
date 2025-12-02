import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import {
  PlayCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import {
  Zap,
  UserCircle,
  MessageSquare,
  Sparkles,
  Video
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

// Helper function to convert credits to USD
const creditsToUSD = (credits: number): string => {
  const usd = credits * 0.018;
  return usd < 1 ? `~$${usd.toFixed(2)}` : `~$${usd.toFixed(0)}`;
};

export default function CharacterAdsShowcasePage() {
  // Example cases data
  const examples = [
    {
      id: 1,
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/character_ads_1_product.jpg',
      videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/character_ads_1_video.mp4',
    },
    {
      id: 2,
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/character_ads_2_product.jpg',
      videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/character_ads_2_video.mp4',
    },
  ];

  const features = [
    {
      icon: UserCircle,
      title: 'Custom Character Settings',
      description: 'Define your character\'s appearance, personality, and style. Create unique brand ambassadors that resonate with your audience.',
    },
    {
      icon: MessageSquare,
      title: 'Custom Dialogue Content',
      description: 'Script exactly what your character says. Full control over messaging, tone, and call-to-action.',
    },
    {
      icon: Sparkles,
      title: 'Realistic Performance',
      description: 'Natural movements, expressions, and lip-sync powered by advanced AI. Your character feels authentic and engaging.',
    },
    {
      icon: Video,
      title: 'Professional Quality',
      description: 'Powered exclusively by Google Veo3, the industry-leading AI model for high-quality character animation.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-left space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight">
              AI Character-Driven Video Ads
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Bring your products to life with realistic AI characters. Create engaging video advertisements where custom characters showcase your products and deliver your message.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/dashboard/character-ads"
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
              >
                Start Creating
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/#pricing"
                className="inline-flex items-center justify-center gap-2 bg-white text-black border-2 border-gray-300 px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-50 transition-colors"
              >
                View Pricing
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              100 free credits for new users ($1.80 value)
            </p>
          </div>

          {/* TikTok Embed */}
          <div className="flex justify-center lg:justify-end">
            <blockquote
              className="tiktok-embed"
              cite="https://www.tiktok.com/@laolilantian/video/7575453353417657618"
              data-video-id="7575453353417657618"
              style={{ maxWidth: '605px', minWidth: '325px' }}
            >
              <section>
                <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">@laolilantian</a>{' '}
                This video explains how to use UGC advertising to introduce products in flowtra ai.{' '}
                <a title="aimarket" target="_blank" href="https://www.tiktok.com/tag/aimarket?refer=embed">#aimarket</a>{' '}
                <a title="ai" target="_blank" href="https://www.tiktok.com/tag/ai?refer=embed">#ai</a>{' '}
                <a title="ugc" target="_blank" href="https://www.tiktok.com/tag/ugc?refer=embed">#UGC</a>{' '}
                <a title="advertising" target="_blank" href="https://www.tiktok.com/tag/advertising?refer=embed">#advertising</a>{' '}
                <a title="ugccreator" target="_blank" href="https://www.tiktok.com/tag/ugccreator?refer=embed">#ugccreator</a>{' '}
                <a target="_blank" title="♬ original sound - Lantian laoli" href="https://www.tiktok.com/music/original-sound-7575453429700233992?refer=embed">♬ original sound - Lantian laoli</a>
              </section>
            </blockquote>
            <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
          </div>
        </div>
      </section>

      {/* Examples Section - MOVED TO 2ND POSITION */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge and Title */}
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-black text-white rounded-full mb-4">
              <span className="text-sm font-semibold">Real Examples</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              See Characters Come Alive
            </h2>
            <p className="text-lg text-gray-600">
              Real examples of product images transformed into character-driven video ads
            </p>
          </div>

          <div className="space-y-16">
            {examples.map((example, index) => (
              <div
                key={example.id}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Product Image */}
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="space-y-4">
                    <div className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-full">
                      <span className="text-sm font-semibold text-gray-700">
                        Original Product Image
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
                        <Image
                          src={example.productImage}
                          alt={`Product ${example.id}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generated Video */}
                <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                  <div className="space-y-4">
                    <div className="inline-block px-4 py-2 bg-black text-white rounded-full">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <PlayCircleIcon className="w-4 h-4" />
                        AI Character Video Ad
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-lg">
                      <LazyVideoPlayer
                        src={example.videoUrl}
                        wrapperClassName="relative aspect-[3/4] w-full overflow-hidden rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Powerful Features for Engaging Ads
            </h2>
            <p className="text-lg text-gray-600">
              Complete control over character-driven storytelling
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <feature.icon className="w-6 h-6 text-black" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-black mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Create character-driven video ads in three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Product Image',
                description: 'Start with a clear photo of your product. This will be featured in your character-driven advertisement.',
              },
              {
                step: '02',
                title: 'Customize Character & Script',
                description: 'Define your character\'s appearance and personality. Write the dialogue and message you want to convey.',
              },
              {
                step: '03',
                title: 'Generate Character Video',
                description: 'AI creates a realistic character video showcasing your product with natural movements and expressions.',
              },
            ].map((item, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-black text-white rounded-full text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-black">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - WITH USD VALUES */}
      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Professional Quality Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Character Ads use Google Veo3 for the highest quality character animation
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-gray-200 p-12">
              <div className="text-center space-y-6">
                <div className="inline-block px-6 py-3 bg-black text-white rounded-full">
                  <span className="text-lg font-bold">
                    Google Veo3 Powered
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-5xl font-bold text-black">
                    150 credits
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {creditsToUSD(150)}
                  </div>
                  <div className="text-lg text-gray-600">
                    per 8-second video
                  </div>
                </div>
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Premium quality character animation</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Realistic facial expressions and movements</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Natural lip-sync with dialogue</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Credits charged at generation time</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-300">
                  <p className="text-sm text-gray-600">
                    Character Ads exclusively use Google Veo3 model for optimal quality and realistic character performance. This ensures your video ads have professional-grade animation and natural character movements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-gray-600">
              Character Ads work great for businesses that want personal connection
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              'Brand Storytelling',
              'Product Demos',
              'Testimonials',
              'Educational Content',
              'Service Promotion',
              'Social Media',
              'Video Marketing',
              'Customer Engagement',
            ].map((useCase, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center hover:shadow-md transition-shadow"
              >
                <p className="font-semibold text-gray-900">{useCase}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-gray-200 p-12 space-y-6">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black">
              Create Your First Character Ad
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join businesses using AI characters to create more engaging and personal video advertisements
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/dashboard/character-ads"
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
              >
                Get Started - 100 Free Credits (~$1.80)
                <Zap className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
