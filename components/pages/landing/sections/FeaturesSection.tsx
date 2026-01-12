import Link from "next/link";
import { UserPlus, Copy, ArrowRight, Check } from "lucide-react";
import { LazyVideoPlayer } from "@/components/pages/landing/LazyVideoPlayer";

export default function FeaturesSection() {
  return (
    <section className="py-16 lg:py-24">
      <div className="text-center max-w-3xl mx-auto mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
          Explore Our Features
        </h2>

        <p className="text-lg text-[#666666]">
          Powerful AI tools to transform your product images into professional
          marketing content
        </p>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-24">
          {/* Feature 1: Competitor Replica */}

          <article className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left (visually right): Content */}

            <div className="flex-1 space-y-8">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 bg-[#F7F7F7] rounded-lg flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <Copy className="w-6 h-6 text-black" />
                </div>

                <div>
                  <h3 className="text-[24px] font-bold text-black mb-3">
                    Competitor Replica
                  </h3>

                  <p className="text-lg text-[#666666] leading-relaxed">
                    Clone top-performing competitor videos with AI. Replicate
                    proven creative structures in minutes.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pl-0 md:pl-12">
                <ul className="space-y-4">
                  {[
                    "Max 60 seconds",

                    "Supports custom editing",

                    "Replace your products, people, or pets",

                    "Supports English, Spanish, and 10+ languages",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-[#666666]"
                    >
                      <Check className="w-4 h-4 text-black flex-shrink-0" />

                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/features/competitor-replica"
                  className="inline-flex items-center gap-2 text-black font-semibold hover:gap-3 transition-all pt-2 border-b-2 border-transparent hover:border-black"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right (visually left): Videos */}

            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full text-[12px] font-bold uppercase tracking-wider text-black">
                    Competitor Video
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_origin.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    Flowtra Clone
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_result.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Feature 2: Avatar Ads */}

          <article className="flex flex-col lg:flex-row-reverse items-center gap-16">
            {/* Left: Content */}

            <div className="flex-1 space-y-8">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 bg-[#F7F7F7] rounded-lg flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <UserPlus className="w-6 h-6 text-black" />
                </div>

                <div>
                  <h3 className="text-[24px] font-bold text-black mb-3">
                    Avatar Ads
                  </h3>

                  <p className="text-lg text-[#666666] leading-relaxed">
                    Create avatar-driven video advertisements with realistic AI
                    characters powered by Google Veo3.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pl-0 md:pl-12">
                <ul className="space-y-4">
                  {[
                    "$0.3 per 8 seconds",

                    "Supports English, Chinese, and 10+ languages",

                    "Generate up to 80 seconds",

                    "Supports custom scripts",

                    "Unlimited character uploads",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-[#666666]"
                    >
                      <Check className="w-4 h-4 text-black flex-shrink-0" />

                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/features/avatar-ads"
                  className="inline-flex items-center gap-2 text-black font-semibold hover:gap-3 transition-all pt-2 border-b-2 border-transparent hover:border-black"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Video */}

            <div className="flex-1 w-full">
              <div className="relative aspect-[9/16] max-w-[320px] mx-auto bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/character-ad-case-1.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  playsInline
                  loop
                />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
