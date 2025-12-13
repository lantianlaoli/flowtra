import Link from 'next/link';
import { UserPlus, Copy, ArrowRight, Check } from 'lucide-react';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

export default function FeaturesSection() {
  return (
    <section className="py-16 lg:py-24">
      <div className="text-center max-w-3xl mx-auto mb-16 px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
          Explore Our Features
        </h2>
        <p className="text-lg text-gray-600">
          Powerful AI tools to transform your product images into professional marketing content
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-20">
          {/* Feature 1: Character Ads */}
          <article className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Content */}
            <div className="flex-1 space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <UserPlus className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-black mb-3">
                    Character Ads
                  </h3>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    Create character-driven video advertisements with realistic AI characters powered by Google Veo3.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pl-0 md:pl-16">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">$0.36 per 8 seconds</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Supports English, Chinese, and 10+ languages</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Generate up to 80 seconds</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Supports custom scripts</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Unlimited character uploads</span>
                  </li>
                </ul>

                <Link
                  href="/features/character-ads"
                  className="inline-flex items-center gap-2 text-black font-semibold hover:gap-3 transition-all pt-2"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Video */}
            <div className="flex-1 w-full">
              <div className="relative aspect-[9/16] max-w-[320px] mx-auto bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 transition-all duration-300 hover:-translate-y-2">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/character-ad-case-1.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  playsInline
                  loop
                />              </div>
            </div>
          </article>

          {/* Feature 2: Competitor Replica */}
          <article className="flex flex-col lg:flex-row-reverse items-center gap-12">
            {/* Left (visually right): Content */}
            <div className="flex-1 space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <Copy className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-black mb-3">
                    Competitor Replica
                  </h3>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    Clone top-performing competitor videos with AI. Replicate proven creative structures in minutes.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pl-0 md:pl-16">
                <ul className="space-y-3 mb-4">
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Max 60 seconds</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Supports custom editing</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Veo3.1 Fast model unlimited free generation</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="font-medium">Supports English, Chinese, and 10+ languages</span>
                  </li>
                </ul>
                <Link
                  href="/features/competitor-replica"
                  className="inline-flex items-center gap-2 text-black font-semibold hover:gap-3 transition-all pt-2"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right (visually left): Videos */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-full text-sm font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Competitor Video
                  </div>
                  <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 transition-all duration-300 hover:-translate-y-2">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_origin.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />                  </div>
                </div>
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Flowtra Clone
                  </div>
                  <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 transition-all duration-300 hover:-translate-y-2">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_result.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}