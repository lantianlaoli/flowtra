import Image from 'next/image';
import { GiftIcon, Check, UserPlus, Play, Lightbulb } from 'lucide-react';
import { HeroPrimaryButton } from '@/components/pages/landing/HeroPrimaryButton';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import BlackFridayBadge from '@/components/landing/BlackFridayBadge';
import { Download } from 'lucide-react';
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

        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight">
          UGC Videos Made for <u>Small Businesses</u>
        </h1>

        <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
          UGC videos for local stores, Shopify sellers, and dropshippers.
        </p>

        {/* New users label + key benefits under subtitle */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {/* Mobile: single concise pill */}
          <span className="inline-flex sm:hidden items-center gap-2 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
            <GiftIcon className="w-4 h-4" />
            <span>100 free credits ($1.80 value)</span>
          </span>
          {/* Desktop/Tablet: original two pills */}
          <span className="hidden sm:inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
            <GiftIcon className="w-4 h-4" />
            <span>For new users: 100 free credits ($1.80 value)</span>
          </span>
        </div>





        {/* CTA Buttons */}
        <div className="flex flex-row items-start gap-3">
          <HeroPrimaryButton />
          {/* Tutorial Video Button */}
          <a
            href="https://www.youtube.com/watch?v=pMxwEIh6ciQ"
            target="_blank"
            rel="noopener noreferrer"
            className="silk-button relative h-14 px-6 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer"
            title="See how easy it is"
          >
            <span className="sm:hidden">Watch</span>
            <span className="hidden sm:inline silk-content">
              <span className="silk-default">
                <Play className="w-5 h-5" />
                <span>See How Easy</span>
              </span>
              <span className="silk-hover">
                <Lightbulb className="w-5 h-5" />
                <span>Watch tutorial</span>
              </span>
            </span>
          </a>
        </div>

        {/* Social Proof under CTA - only show with real metric */}
        {activatedUserCount > 0 && (
          <div className="pt-3" aria-label="Social proof">
            <div
              className="inline-flex min-w-[240px] items-center gap-3 rounded-2xl px-4 py-2
                         bg-black/5 dark:bg-white/5 ring-1 ring-inset ring-black/10 dark:ring-white/10
                         transition-colors hover:ring-black/20 dark:hover:ring-white/20"
            >
              {/* Avatars group */}
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="inline-block w-7 h-7 rounded-full ring-2 ring-white/80 dark:ring-zinc-900/80 overflow-hidden">
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
        <div className="relative w-full max-w-[320px] aspect-[9/16] bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
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
