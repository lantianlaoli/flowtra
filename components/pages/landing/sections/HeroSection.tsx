import Image from 'next/image';
import { GiftIcon, Check } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';
import { HeroPrimaryButton } from '@/components/pages/landing/HeroPrimaryButton';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import BlackFridayBadge from '@/components/landing/BlackFridayBadge';
import FounderCard from '@/components/ui/FounderCard';

interface HeroSectionProps {
  activatedUserCount: number;
}

export default function HeroSection({ activatedUserCount }: HeroSectionProps) {
  return (
    <section id="hero" className="grid lg:grid-cols-5 items-center py-10 sm:py-12 lg:py-16 gap-6 sm:gap-8 lg:gap-12 scroll-mt-24">
      {/* Left Content */}
      <div className="lg:col-span-3 space-y-5 sm:space-y-6 lg:space-y-8">
        {/* Black Friday Promotion Badge + Founder Card */}
        <div className="flex flex-wrap items-center gap-3">
          <BlackFridayBadge />
          <FounderCard variant="hero" showGreeting={false} className="hidden lg:inline-flex" />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight tracking-[-0.02em]">
          Turn Your Competitors' <span className="underline decoration-[#E5E5E5] underline-offset-8">Viral Videos</span> Into Your Own
        </h1>

        <p className="text-xl text-[#666666] leading-relaxed max-w-lg">
          Clone top-performing TikTok ads and Instagram Reels with AI. Built for small businesses who want proven creative that converts.
        </p>

        {/* Selling points */}
        <div className="mt-4 space-y-3 text-[#666666] text-[16px]">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-black" />
            <span>Clone viral TikTok, Instagram, and YouTube UGC in minutes</span>
          </div>

          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-black" />
            <span>Replace competitor products with yours automatically</span>
          </div>

          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-black" />
            <span>Videos from $0.30 per 8 seconds (150x cheaper than hiring UGC creators)</span>
          </div>

          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-black" />
            <span>Supports English, Chinese, and over 10 other languages</span>
          </div>
        </div>





        {/* CTA Buttons */}
        <div className="flex flex-row items-start gap-3">
          <HeroPrimaryButton />
          {/* Discord Community Button */}
          <a
            href="https://discord.gg/dd5Qh54S"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#5865F2] hover:bg-[#4752C4] relative h-14 px-6 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer text-white transition-all duration-200 hover:-translate-y-[1px] active:translate-y-0"
            title="Join our Discord community"
          >
            <SiDiscord className="w-5 h-5" />
            <span>Join our Community</span>
          </a>
        </div>

        {/* Social Proof under CTA - only show with real metric */}
        {activatedUserCount > 0 && (
          <div className="pt-3" aria-label="Social proof">
            <div
              className="inline-flex min-w-[240px] items-center gap-3 rounded-xl px-4 py-2
                         bg-[#F7F7F7] border border-[#E5E5E5] transition-colors"
            >
              {/* Avatars group */}
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="inline-block w-7 h-7 rounded-full ring-2 ring-white overflow-hidden">
                    <Image
                      src={`https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_${i}.${i === 1 ? 'jpg' : 'png'}`}
                      alt={`User avatar ${i}`}
                      width={28}
                      height={28}
                      sizes="28px"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              {/* Single-line copy for harmony with avatars */}
              <span
                className="text-sm font-semibold text-black whitespace-nowrap"
                title={`${activatedUserCount.toLocaleString('en-US')} small business owners trust Flowtra`}
              >
                {`Trusted by `}
                <span className="font-bold tabular-nums">
                  {activatedUserCount.toLocaleString('en-US')}
                </span>
                {` small business owners`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right Demo - Single Video Layout */}
      <div className="lg:col-span-2 flex justify-center items-center">
        <div className="relative w-full max-w-[320px] aspect-[9/16] bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-[#E5E5E5]">
          <LazyVideoPlayer
            wrapperClassName="w-full h-full"
            className="w-full h-full object-cover"
            src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/hero_example.mp4"
            ariaLabel="UGC video example for small businesses"
            autoPlay
            loop
            playsInline
          />
        </div>
      </div>
    </section>
  );
}
