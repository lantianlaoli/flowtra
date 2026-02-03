import Link from 'next/link';
import {
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import {
  Zap,
  Users,
  Wand2,
  Video,
  Check,
  Target,
  Sparkles
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import { BookDemoCTA } from '@/components/cta/BookDemoCTA';

export default function MotionSwapShowcasePage() {
  const features = [
    {
      icon: Users,
      title: 'One-Click Creator Clone',
      description: 'Simply enter a creator\'s name or paste their TikTok URL. Our AI instantly finds and analyzes their viral content.',
    },
    {
      icon: Target,
      title: 'Motion Preservation',
      description: 'Keep the exact movements, actions, and background elements that made the original video go viral. Only swap the person and product.',
    },
    {
      icon: Wand2,
      title: 'Smart Frame Control',
      description: 'Preview and edit the first frame before generation. Adjust character position, product placement, and scene details for perfect results.',
    },
    {
      icon: Video,
      title: 'Professional Quality',
      description: 'Powered by cutting-edge AI models that understand motion dynamics and preserve the original video\'s appeal.',
    },
  ];

  const useCases = [
    'Product Launch Ads',
    'E-commerce Videos',
    'Social Media Content',
    'Brand Marketing',
    'Competitive Analysis',
    'A/B Testing Creative',
    'Influencer Replication',
    'Viral Content Clone',
  ];

  // Video comparison pairs
  const comparisons = [
    {
      refer: 'features_videos/motion_swap_refer_1.mp4',
      result: 'features_videos/motion_swap_result_1.mp4',
      title: 'Example 1',
    },
    {
      refer: 'features_videos/motion_swap_refer_2.mp4',
      result: 'features_videos/motion_swap_result_2.mp4',
      title: 'Example 2',
    },
    {
      refer: 'features_videos/motion_swap_refer_3.mp4',
      result: 'features_videos/motion_swap_result_3.mp4',
      title: 'Example 3',
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
              AI Motion Swap
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Clone viral ads in seconds. Just enter a creator&apos;s name and our AI swaps the person and product while keeping the exact movements, actions, and background that made it go viral.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/dashboard"
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
          </div>

          {/* Hero Right: Video Comparison */}
          <div className="flex justify-center lg:justify-end w-full">
            <div className="grid grid-cols-2 gap-4 max-w-[640px] w-full">
              {/* Original Creator Video */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Original
                </div>
                <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-xl overflow-hidden shadow-xl border border-gray-200">
                  <LazyVideoPlayer
                    src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/motion_swap_refer_1.mp4"
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover"
                    playsInline
                    loop
                  />
                </div>
              </div>

              {/* Motion Swap Result */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-full text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Motion Swap
                </div>
                <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-xl overflow-hidden shadow-xl border-2 border-black">
                  <LazyVideoPlayer
                    src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/motion_swap_result_1.mp4"
                    wrapperClassName="h-full w-full"
                    className="h-full w-full object-cover"
                    playsInline
                    loop
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Steps */}
            <div className="space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
                Import Videos in 3 Ways
              </h2>
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="text-xl font-semibold text-black">Paste TikTok URL</h3>
                    <p className="text-gray-600 mt-1">Drop in any TikTok video link to import a reference clip in seconds.</p>
                  </div>
                </div>
                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="text-xl font-semibold text-black">Upload Local Video</h3>
                    <p className="text-gray-600 mt-1">Import MP4 files directly from your device when you already have reference material.</p>
                  </div>
                </div>
                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="text-xl font-semibold text-black">Import from Creator Sources</h3>
                    <p className="text-gray-600 mt-1">Pick saved clips from your creator library and start motion swap without re-uploading.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Video */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200">
              <LazyVideoPlayer
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/import-paths.mp4"
                wrapperClassName="w-full"
                className="w-full h-auto"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1: Creator Input */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Video */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200 group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <LazyVideoPlayer
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/import-tiktok-name.mp4"
                wrapperClassName="w-full"
                className="w-full h-auto"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
            {/* Right: Text */}
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
                Import Viral Videos by Creator Name
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-black rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-black">Search by Creator Name</h3>
                    <p className="text-gray-600">Type a creator name and instantly pull their viral reference videos without manual hunting.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-black rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-black">Start Cloning in Seconds</h3>
                    <p className="text-gray-600">In just a few seconds, begin cloning the ad or swap in a different actor and product to launch a new variant.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-black rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-black">Keep Viral Motion DNA</h3>
                    <p className="text-gray-600">Preserve the original motion, pacing, and camera behavior that made the reference clip perform.</p>
                  </div>
                </li>
              </ul>
              <div className="pt-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
                >
                  Try Now
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Frame Editing */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
                Smart Frame Control
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-black rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-black">Visual Preview</h3>
                    <p className="text-gray-600">See exactly what your first frame will look like before generating the full video.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-black rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-black">Social Media-Style @ Mentions</h3>
                    <p className="text-gray-600">Use @character or @product in your prompt to reference specific assets. Just like tagging on social media - intuitive and powerful for precise control.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-black rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-black">Higher Success Rate</h3>
                    <p className="text-gray-600">No more blind guessing. Edit-preview workflow dramatically improves generation quality and reduces wasted credits.</p>
                  </div>
                </li>
              </ul>
              <div className="pt-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
                >
                  Start Editing
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
            {/* Right: Video */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200 group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <LazyVideoPlayer
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/motion-swap.mp4"
                wrapperClassName="w-full"
                className="w-full h-auto"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Comparison Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              See the Magic in Action
            </h2>
            <p className="text-lg text-gray-600">
              Original creator videos transformed into your product ads - same motion, different story
            </p>
          </div>

          <div className="space-y-16">
            {comparisons.map((comparison, index) => (
              <div key={index} className="grid md:grid-cols-2 gap-8">
                {/* Original */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-black text-center">Original Creator Video</h3>
                  <div className="relative aspect-[9/16] max-w-[320px] mx-auto bg-gray-100 rounded-2xl overflow-hidden shadow-xl border border-gray-200">
                    <LazyVideoPlayer
                      src={`https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/${comparison.refer}`}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls={false}
                      playsInline
                      loop
                    />
                  </div>
                </div>

                {/* Result */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-black text-center flex items-center justify-center gap-2">
                    Your Product Ad
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                  </h3>
                  <div className="relative aspect-[9/16] max-w-[320px] mx-auto bg-gray-100 rounded-2xl overflow-hidden shadow-xl border-2 border-black">
                    <LazyVideoPlayer
                      src={`https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/${comparison.result}`}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls={false}
                      playsInline
                      loop
                    />
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
              Powerful Motion Swap Features
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to clone viral content
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
              Motion Swap works great for businesses that want proven creative formats
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {useCases.map((useCase, index) => (
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
              Clone Your First Viral Ad
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Stop guessing what works. Clone proven viral formats and swap in your product.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors"
              >
                Get Started
                <Zap className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Book Demo CTA - Compact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BookDemoCTA
          variant="compact"
          title="Want to Try Motion Swap?"
          description="Book a demo to explore AI motion cloning with trial access."
        />
      </section>

      <Footer />
    </div>
  );
}
