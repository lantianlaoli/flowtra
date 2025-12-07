import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import {
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

export default function CharacterAdsShowcasePage() {
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

          {/* Hero Right: Landing Page Example Video */}
          <div className="flex justify-center lg:justify-end w-full">
             <div className="relative aspect-[9/16] max-w-[320px] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/character-ad-case-1.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  showControls
                  playsInline
                  loop
                />
              </div>
          </div>
        </div>
      </section>

      {/* Tutorial Section (New) */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Steps */}
              <div className="space-y-8">
                 <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
                    Create in 5 Simple Steps
                 </h2>
                 <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">1</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Configure Brand & Product</h3>
                          <p className="text-gray-600 mt-1">Upload your product image and define your brand style.</p>
                       </div>
                    </div>
                    {/* Step 2 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">2</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Configure Character</h3>
                          <p className="text-gray-600 mt-1">Choose or customize an AI character that fits your brand.</p>
                       </div>
                    </div>
                    {/* Step 3 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">3</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Input Script</h3>
                          <p className="text-gray-600 mt-1">Type out exactly what you want your character to say.</p>
                       </div>
                    </div>
                    {/* Step 4 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">4</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Select Size & Duration</h3>
                          <p className="text-gray-600 mt-1">Supports up to 80 seconds. Choose 9:16 for TikTok/Reels or 16:9 for YouTube.</p>
                       </div>
                    </div>
                    {/* Step 5 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">5</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Start Generation</h3>
                          <p className="text-gray-600 mt-1">Powered by state-of-the-art Veo3.1. Only $0.36 per 8 seconds.</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Right: TikTok Video */}
              <div className="flex justify-center lg:justify-end w-full">
                <blockquote
                  className="tiktok-embed"
                  cite="https://www.tiktok.com/@laolilantian/video/7580211134284745991"
                  data-video-id="7580211134284745991"
                  style={{ maxWidth: '605px', minWidth: '325px' }}
                >
                  <section>
                    <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">@laolilantian</a>{' '}
                    Flowtra AI supports the generation of videos introducing products held by a single person.{' '}
                    <a title="ugccontentcreator" target="_blank" href="https://www.tiktok.com/tag/ugccontentcreator?refer=embed">#ugccontentcreator</a>{' '}
                    <a title="ugccreator" target="_blank" href="https://www.tiktok.com/tag/ugccreator?refer=embed">#ugccreator</a>{' '}
                    <a title="aiads" target="_blank" href="https://www.tiktok.com/tag/aiads?refer=embed">#aiads</a>{' '}
                    <a title="ugc" target="_blank" href="https://www.tiktok.com/tag/ugc?refer=embed">#ugc</a>{' '}
                    <a title="ai" target="_blank" href="https://www.tiktok.com/tag/ai?refer=embed">#AI</a>{' '}
                    <a target="_blank" title="♬ original sound - Lantian laoli" href="https://www.tiktok.com/music/original-sound-7580211250157292296?refer=embed">♬ original sound - Lantian laoli</a>
                  </section>
                </blockquote>
                <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
              </div>
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

      {/* Use Cases Section */}
      <section className="py-16 lg:py-24">
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