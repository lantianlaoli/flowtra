import Image from 'next/image';
import { GiftIcon, Check, UserPlus, Play, Lightbulb } from 'lucide-react';
import { HeroPrimaryButton } from '@/components/pages/landing/HeroPrimaryButton';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import BlackFridayBadge from '@/components/landing/BlackFridayBadge';
import { Download } from 'lucide-react';

interface HeroSectionProps {
  activatedUserCount: number;
}

export default function HeroSection({ activatedUserCount }: HeroSectionProps) {
  return (
    <section id="hero" className="grid lg:grid-cols-5 items-center py-10 sm:py-12 lg:py-16 gap-6 sm:gap-8 lg:gap-12 scroll-mt-24">
      {/* Left Content */}
      <div className="lg:col-span-3 space-y-5 sm:space-y-6 lg:space-y-8">
        {/* Black Friday Promotion Badge */}
        <BlackFridayBadge />

        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight">
          Professional Ads for <u>Small Business</u>
        </h1>

        <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
          AI ads for <span className="inline-block bg-[#F56400] text-white px-2 py-1 rounded-md font-semibold">Etsy</span>, <span className="inline-block bg-[#95BF47] text-white px-2 py-1 rounded-md font-semibold">Shopify</span>, <span className="inline-block bg-[#FF90E8] text-white px-2 py-1 rounded-md font-semibold">Gumroad</span>, <span className="inline-block bg-[#6C5CE7] text-white px-2 py-1 rounded-md font-semibold">Stan</span>, social platforms, and local stores.
        </p>

        {/* New users label + key benefits under subtitle */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {/* Mobile: single concise pill */}
          <span className="inline-flex sm:hidden items-center gap-2 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
            <GiftIcon className="w-4 h-4" />
            <span>100 free credits (~$1.80 value)</span>
          </span>
          {/* Desktop/Tablet: original two pills */}
          <span className="hidden sm:inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
            <UserPlus className="w-4 h-4" />
            <span>For new users</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
            <GiftIcon className="w-4 h-4" />
            <span>100 free credits (~$1.80 value)</span>
          </span>
        </div>

        {/* Mobile: compact benefits */}
        <div className="sm:hidden text-gray-700 text-sm mt-2">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
              <Check className="w-4 h-4 text-green-600" />
              <span>Unlimited gen</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
              <Check className="w-4 h-4 text-green-600" />
              <span>No watermark</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
              <Check className="w-4 h-4 text-green-600" />
              <span>Free images</span>
            </span>
          </div>
        </div>

        {/* Desktop/Tablet: detailed benefits */}
        <ul className="hidden sm:flex text-gray-700 text-sm sm:text-base flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mt-2">
          <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
            <Check className="w-4 h-4 text-green-600" />
            <span className="break-words">
              Images: <span className="font-semibold underline">unlimited</span> generation + free downloads (
              <span className="font-semibold underline">no watermark</span>)
            </span>
          </li>
          <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
            <Check className="w-4 h-4 text-green-600" />
            <span className="break-words">
              Videos: <span className="font-semibold underline">unlimited</span> generation;download each video is worth ~$0.54 (
              <span className="font-semibold underline">no watermark</span>)
            </span>
          </li>
          <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
            <Check className="w-4 h-4 text-green-600" />
            <span className="break-words"><span className="font-semibold underline">Unlimited</span> product configurations</span>
          </li>
          <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
            <Check className="w-4 h-4 text-green-600" />
            <span className="break-words">Portraits: <span className="font-semibold underline">unlimited</span> character additions</span>
          </li>
        </ul>

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

      {/* Right Demo - Multi-Output Layout */}
      <div className="lg:col-span-2 space-y-5 sm:space-y-6 flex flex-col justify-center">
        {/* Original Image - Top */}
        <div className="relative w-48 mx-auto">
          <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[3/4]">
            <Image
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example.png"
              alt="AI video advertisement generator showing product photo transformation for Amazon and Walmart ads"
              width={300}
              height={400}
              sizes="(max-width: 640px) 192px, (max-width: 768px) 192px, 192px"
              priority
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Simple Arrow */}
        <div className="flex justify-center py-2">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>

        {/* Dual Output - Bottom */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 max-w-md mx-auto">
          {/* Free Cover - Left */}
          <div className="relative">
            <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-green-200 shadow-sm aspect-[3/4] hover:border-green-300 transition-colors">
              <Image
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example_cover.png"
                alt="AI-generated product cover design - free download"
                width={300}
                height={400}
                sizes="(max-width: 640px) 145px, (max-width: 768px) 181px, 248px"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
              <Download className="w-3 h-3" />
              FREE
            </div>
          </div>

          {/* Premium Video - Right */}
          <div className="relative">
            <LazyVideoPlayer
              wrapperClassName="bg-gray-900 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[3/4]"
              className="w-full h-full rounded-lg object-contain"
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example.mp4"
              ariaLabel="AI-generated video advertisement example showing product transformation"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
