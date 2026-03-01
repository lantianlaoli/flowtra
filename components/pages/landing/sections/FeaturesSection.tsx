import Link from "next/link";
import { UserPlus, Copy, ArrowRight, Check, RefreshCw, Bot, AtSign, Replace, MessageSquareText } from "lucide-react";
import { LazyVideoPlayer } from "@/components/pages/landing/LazyVideoPlayer";

export default function FeaturesSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24">
      <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
          Explore Our Features
        </h2>

        <p className="text-base md:text-lg text-[#666666]">
          Powerful AI tools to transform your product images into professional
          marketing content
        </p>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-14 md:gap-24">
          {/* Feature 1: Viral Clone */}

          <article className="flex flex-col lg:flex-row items-center gap-10 md:gap-16">
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
                    Viral Clone
                  </h3>

                  <p className="text-lg text-[#666666] leading-relaxed">
                    Clone top-performing viral videos with AI. Clone proven
                    creative structures in minutes.
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
                  href="/features/viral-clone"
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
                    <span className="text-[12px]">🔥</span>
                    Viral Video
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_competitor_source.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    <span className="text-[12px]">🧬</span>
                    Clone
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_competitor_result.mp4"
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

          <article className="flex flex-col lg:flex-row-reverse items-center gap-10 md:gap-16">
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

                    "Supports English, Spanish, and 10+ languages",

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
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/character_ads_case.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  playsInline
                  loop
                />
              </div>
            </div>
          </article>

          <article className="flex flex-col lg:flex-row-reverse items-center gap-10 md:gap-16">
            <div className="flex-1 space-y-8">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 bg-[#F7F7F7] rounded-lg flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <Bot className="w-6 h-6 text-black" />
                </div>

                <div>
                  <h3 className="text-[24px] font-bold text-black mb-3">
                    AI Agent
                  </h3>

                  <p className="text-lg text-[#666666] leading-relaxed">
                    Talk through image prompts, video prompts, people swaps, and product swaps with an agent built for long-form clone workflows.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pl-0 md:pl-12">
                <ul className="space-y-4">
                  {[
                    "Automatic people and product replacement",
                    "@mentions for asset referencing",
                    "Supports TikTok clone workflows up to 60 seconds",
                    "Subscribers use it without credit deductions",
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
                  href="/features/ai-agent"
                  className="inline-flex items-center gap-2 text-black font-semibold hover:gap-3 transition-all pt-2 border-b-2 border-transparent hover:border-black"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full">
              <div className="max-w-xl mx-auto rounded-[28px] border border-[#E5E5E5] bg-white p-4 shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
                <div className="rounded-[22px] border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                  <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#666666]">Agent Workspace</p>
                      <p className="mt-1 text-lg font-semibold text-black">Prompt-driven cloning</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                      <AtSign className="w-3.5 h-3.5" />
                      Asset-aware
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl bg-black px-4 py-3 text-sm text-white">
                      Swap <span className="font-semibold">@character(jade)</span> into scene 1 and replace the product with <span className="font-semibold">@product(flexbeam)</span>. Keep the original pacing.
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
                        <Replace className="w-4 h-4 text-black" />
                        <p className="mt-3 text-sm font-semibold text-black">Prompt replacement</p>
                      </div>
                      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
                        <MessageSquareText className="w-4 h-4 text-black" />
                        <p className="mt-3 text-sm font-semibold text-black">Chat-first editing</p>
                      </div>
                      <div className="rounded-2xl border border-dashed border-[#D0D0D0] bg-white p-4">
                        <p className="text-sm font-semibold text-black">Clone asset slot</p>
                        <p className="mt-2 text-xs leading-relaxed text-[#666666]">Reserved for future before-and-after media.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Feature 3: Motion Swap */}

          <article className="flex flex-col lg:flex-row items-center gap-10 md:gap-16">
            {/* Left (visually right): Content */}

            <div className="flex-1 space-y-8">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 bg-[#F7F7F7] rounded-lg flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <RefreshCw className="w-6 h-6 text-black" />
                </div>

                <div>
                  <h3 className="text-[24px] font-bold text-black mb-3">
                    Motion Swap
                  </h3>

                  <p className="text-lg text-[#666666] leading-relaxed">
                    Clone viral ads in seconds. Enter a creator&apos;s name and swap person and product while preserving the exact movements.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pl-0 md:pl-12">
                <ul className="space-y-4">
                  {[
                    "One-click creator search",

                    "Motion preservation technology",

                    "Smart first frame editing",

                    "Higher success rate with visual preview",
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
                  href="/features/motion-swap"
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
                    Original Creator
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_refer.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    Motion Swap
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_result.mp4"
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
        </div>
      </div>
    </section>
  );
}
