import Link from 'next/link';
import {
  PlayCircleIcon,
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
  const replicaCases = [
    {
      id: '01',
      competitorVideo: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/replica_competitor_01.mp4',
      resultVideo: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/replica_result_01.mp4',
    },
    {
      id: '02',
      competitorVideo: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/replica_competitor_02.mp4',
      resultVideo: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/replica_result_02.mp4',
    },
  ];

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
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block px-4 py-2 bg-black text-white rounded-full mb-6">
              <span className="text-sm font-semibold">Replica UGC Demo</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
              Recreate Competitor Videos in Minutes
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Flowtra replicates top-performing UGC so you can launch proven creatives faster. Clone the creative structure, replace the product, and dominate your market.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard/competitor-ugc-replication"
                className="inline-flex items-center justify-center px-8 py-4 bg-black text-white rounded-lg font-semibold hover:bg-gray-900 transition-colors"
              >
                Try It Now
                <ArrowRightIcon className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-black border-2 border-black rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              See It In Action
            </h2>
            <p className="text-lg text-gray-600">
              Real examples of competitor videos transformed into your branded content
            </p>
          </div>
          <div className="space-y-16">
            {replicaCases.map((example, index) => {
              const isReversed = index % 2 === 1;

              return (
                <div
                  key={example.id}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
                >
                  <div className={`${isReversed ? 'lg:order-2' : 'lg:order-1'}`}>
                    <div className="space-y-4">
                      <div className="inline-block px-4 py-2 bg-white border border-gray-300 rounded-full">
                        <span className="text-sm font-semibold text-gray-700">
                          Competitor Video
                        </span>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                        <LazyVideoPlayer
                          src={example.competitorVideo}
                          wrapperClassName="relative aspect-[9/16] w-full overflow-hidden rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                  <div className={`${isReversed ? 'lg:order-1' : 'lg:order-2'}`}>
                    <div className="space-y-4">
                      <div className="inline-block px-4 py-2 bg-black text-white rounded-full">
                        <span className="text-sm font-semibold flex items-center gap-2">
                          <PlayCircleIcon className="w-4 h-4" />
                          Flowtra Result
                        </span>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-lg">
                        <LazyVideoPlayer
                          src={example.resultVideo}
                          wrapperClassName="relative aspect-[9/16] w-full overflow-hidden rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
                    <IconComponent className="w-6 h-6 text-gray-900" />
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

      {/* How It Works Section */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Three simple steps to clone competitor success
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                1
              </div>
              <h3 className="text-2xl font-bold text-black mb-3">
                Upload Competitor Video
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Select a high-performing competitor video that you want to replicate. Our AI will analyze the complete structure.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                2
              </div>
              <h3 className="text-2xl font-bold text-black mb-3">
                AI Analyzes Structure
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Our AI extracts the video script, camera movements, visual style, and narrative flow from the competitor ad.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                3
              </div>
              <h3 className="text-2xl font-bold text-black mb-3">
                Generate Your Version
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Receive a video that clones the structure but features your product, maintaining the proven creative framework.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Price Comparison Section */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full mb-4">
              <span className="text-sm font-semibold">Price Comparison</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Up to 6.5X Cheaper Than Creatify
            </h2>
            <p className="text-lg text-gray-600">
              Get the same quality videos at a fraction of the cost
            </p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 bg-gray-50">Feature</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-900 bg-gray-50">Creatify.ai</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white bg-black">Flowtra AI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Credit Value</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">$0.39 per credit</td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">$0.0144 per credit</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Video Length</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">5 seconds</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">5 seconds</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Credits Required</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">3 credits</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">12.5 credits</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">Total Cost</td>
                    <td className="px-6 py-4 text-center text-lg font-bold text-red-600">$1.17</td>
                    <td className="px-6 py-4 text-center text-lg font-bold text-green-600">$0.18</td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="px-6 py-5 text-sm font-bold text-gray-900">Cost Per Second</td>
                    <td className="px-6 py-5 text-center text-base text-gray-600">$0.234/sec</td>
                    <td className="px-6 py-5 text-center text-xl font-bold text-green-600">$0.036/sec</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-6 py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-t-2 border-green-200">
              <div className="flex items-center justify-center gap-3">
                <div className="text-3xl font-bold text-green-600">💰</div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    Save up to <span className="text-green-600">$0.99 per video</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    That&apos;s <span className="font-semibold">~85% cheaper</span> than Creatify!
                  </p>
                </div>
                <div className="text-3xl font-bold text-green-600">🎉</div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              * Prices based on Black Friday discounts. Flowtra subscription: $7.20 for 500 credits
            </p>
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
                className="bg-gray-50 rounded-xl px-6 py-4 text-center border border-gray-200"
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
