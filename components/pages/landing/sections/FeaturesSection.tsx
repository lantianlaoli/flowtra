import Link from "next/link";
import { UserPlus, Copy, ArrowRight, Check, RefreshCw, Bot } from "lucide-react";
import { LazyVideoPlayer } from "@/components/pages/landing/LazyVideoPlayer";

type FeatureSectionProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
  media: React.ReactNode;
  mediaFirst?: boolean;
  isNew?: boolean;
};

function FeatureSection({
  title,
  description,
  href,
  icon: Icon,
  bullets,
  media,
  mediaFirst = false,
  isNew = false,
}: FeatureSectionProps) {
  return (
    <article className="grid items-center gap-10 md:gap-16 lg:grid-cols-2">
      <div
        className={`flex-1 space-y-8 ${
          mediaFirst ? "lg:order-2" : "lg:order-1"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 bg-[#F7F7F7] rounded-lg flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <Icon className="w-6 h-6 text-black" />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[24px] font-bold text-black">{title}</h3>
              {isNew ? (
                <span className="inline-flex items-center rounded-full bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  New
                </span>
              ) : null}
            </div>

            <p className="text-lg text-[#666666] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-4 pl-0 md:pl-12">
          <ul className="space-y-4">
            {bullets.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[#666666]">
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>

          <Link
            href={href}
            className="inline-flex items-center gap-2 text-black font-semibold hover:gap-3 transition-all pt-2 border-b-2 border-transparent hover:border-black"
          >
            Learn More
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div
        className={`flex-1 w-full ${
          mediaFirst ? "lg:order-1" : "lg:order-2"
        }`}
      >
        {media}
      </div>
    </article>
  );
}

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
          <FeatureSection
            title="AI Agent"
            description="Talk through clone workflows with an agent that already supports clone videos today, with avatar and motion swap support coming next."
            href="/features/ai-agent"
            icon={Bot}
            isNew
            bullets={[
              "Clone videos supported now",
              "Avatar workflow coming soon",
              "Motion swap workflow coming soon",
              "@mentions for asset-aware prompt edits",
            ]}
            media={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full text-[12px] font-bold uppercase tracking-wider text-black">
                    Reference Video
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_refer_1.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    Agent Result
                  </div>

                  <div className="relative aspect-[9/16] w-full bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_result_1.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
            }
          />

          <FeatureSection
            title="Viral Clone"
            description="Clone top-performing viral videos with AI. Clone proven creative structures in minutes."
            href="/features/viral-clone"
            icon={Copy}
            mediaFirst
            bullets={[
              "Max 60 seconds",
              "Supports custom editing",
              "Replace your products, people, or pets",
              "Supports English, Spanish, and 10+ languages",
            ]}
            media={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full text-[12px] font-bold uppercase tracking-wider text-black">
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
            }
          />

          <FeatureSection
            title="Avatar Ads"
            description="Create avatar-driven video advertisements with realistic AI characters powered by Google Veo3."
            href="/features/avatar-ads"
            icon={UserPlus}
            bullets={[
              "$0.3 per 8 seconds",
              "Supports English, Spanish, and 10+ languages",
              "Generate up to 80 seconds",
              "Supports custom scripts",
              "Unlimited character uploads",
            ]}
            media={
              <div className="relative aspect-[9/16] max-w-[320px] mx-auto bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/character_ads_case.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  playsInline
                  loop
                />
              </div>
            }
          />

          <FeatureSection
            title="Motion Swap"
            description="Clone viral ads in seconds. Enter a creator&apos;s name and swap person and product while preserving the exact movements."
            href="/features/motion-swap"
            icon={RefreshCw}
            mediaFirst
            bullets={[
              "One-click creator search",
              "Motion preservation technology",
              "Smart first frame editing",
              "Higher success rate with visual preview",
            ]}
            media={
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
            }
          />
        </div>
      </div>
    </section>
  );
}
