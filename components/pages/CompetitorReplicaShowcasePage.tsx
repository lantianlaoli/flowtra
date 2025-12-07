import Link from 'next/link';
import Script from 'next/script';
import {
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import {
  Copy,
  Zap,
  Target,
  Sparkles
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

export default function CompetitorReplicaShowcasePage() {
  const features = [
    {
      icon: Copy,
      title: 'Clone Creative Structure',
      description: 'AI analyzes competitor videos to extract the complete narrative structure, camera movements, and visual style.',
    },
    {
      icon: Sparkles,
      title: 'Smart Product Replacement',
      description: 'Seamlessly replace competitor products with yours while maintaining the proven creative framework.',
    },
    {
      icon: Zap,
      title: 'Minutes, Not Days',
      description: 'Launch competitive creatives in minutes instead of weeks of production time and creative brainstorming.',
    },
    {
      icon: Target,
      title: 'Proven Performance',
      description: 'Build on top-performing competitor ads that have already proven to resonate with your target audience.',
    },
  ];

  const useCases = [
    'Quick Market Entry',
    'Competitive Analysis',
    'A/B Testing',
    'Product Launches',
    'Social Media Ads',
    'E-commerce Marketing',
    'Dropshipping Stores',
    'Brand Competition',
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-black text-white rounded-full mb-6">
                <span className="text-sm font-semibold">Replica UGC Demo</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                Clone a Top Competitor Video
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Flowtra mapped this entire competitor ad beat-for-beat, swapped the product, and delivered a launch-ready clone in minutes. Same structure. Same energy. Your brand.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/dashboard/competitor-ugc-replication"
                  className="inline-flex items-center justify-center px-8 py-4 bg-black text-white rounded-lg font-semibold hover:bg-gray-900 transition-colors"
                >
                  Start Cloning
                  <ArrowRightIcon className="ml-2 w-5 h-5" />
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-black border-2 border-black rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  View Pricing
                </Link>
              </div>
            </div>
            
            {/* Hero Right: Side-by-Side Comparison */}
            <div className="flex justify-center lg:justify-end w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[600px]">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-full text-sm font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Competitor Video
                  </div>
                  <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_origin.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls
                      playsInline
                      loop
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Flowtra Clone
                  </div>
                  <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_result.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
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
                    Clone in 5 Simple Steps
                 </h2>
                 <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">1</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Configure Brand & Product</h3>
                          <p className="text-gray-600 mt-1">Upload your product image and define your brand details.</p>
                       </div>
                    </div>
                    {/* Step 2 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">2</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Upload & Analyze</h3>
                          <p className="text-gray-600 mt-1">Upload a competitor UGC video. AI automatically analyzes the shot content.</p>
                       </div>
                    </div>
                    {/* Step 3 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">3</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Select Video to Clone</h3>
                          <p className="text-gray-600 mt-1">Choose the specific video you want to replicate.</p>
                       </div>
                    </div>
                    {/* Step 4 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">4</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Edit Segments & Prompts</h3>
                          <p className="text-gray-600 mt-1">Edit segment photos and video prompts until satisfied.</p>
                       </div>
                    </div>
                    {/* Step 5 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">5</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Merge Final Video</h3>
                          <p className="text-gray-600 mt-1">Combine segments to generate the final video.</p>
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
              Why Choose Competitor Replica?
            </h2>
            <p className="text-lg text-gray-600">
              Leverage proven creative strategies without the guesswork
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                    <IconComponent className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="text-xl font-bold text-black mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
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
              Use cases where competitor replica excels
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="bg-white rounded-xl px-6 py-6 text-center border border-gray-200 hover:shadow-md transition-shadow"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {useCase}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Clone Winning Ads?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Start replicating top-performing competitor videos today. No credit card required to try.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard/competitor-ugc-replication"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Creating
              <SparklesIcon className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-white border-2 border-white rounded-lg font-semibold hover:bg-white hover:text-black transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}