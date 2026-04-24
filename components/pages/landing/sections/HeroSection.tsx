'use client';

import Image from "next/image";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  GiftIcon,
  Check,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Sparkles,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { Google, Kling } from "@lobehub/icons";
import TikTokInputHero from "@/components/pages/landing/TikTokInputHero";
import { LazyVideoPlayer } from "@/components/pages/landing/LazyVideoPlayer";
import BlackFridayBadge from "@/components/landing/BlackFridayBadge";
import { SocialProofBadge } from "@/components/pages/landing/SocialProofBadge";
import { useI18n } from "@/providers/I18nProvider";

const SITE_ASSET_BASE_URL =
  "https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets";

function LiveModelBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#fafafa] border border-[#e9e9e7] rounded-full text-sm shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs font-semibold text-[#37352f]">{label}</span>
      <span
        aria-hidden="true"
        className="relative ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center"
      >
        <span className="absolute inset-0 rounded-full bg-emerald-400/35 blur-[2px] motion-safe:animate-pulse motion-reduce:animate-none" />
        <span className="absolute h-3.5 w-3.5 rounded-full border border-emerald-400/45 bg-emerald-400/10" />
        <span className="absolute h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.55)]" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-white/75" />
      </span>
    </div>
  );
}

export default function HeroSection() {
  const { messages } = useI18n();
  const heroMessages = messages.landing.hero;

  return (
    <section
      id="hero"
      className="grid lg:grid-cols-5 items-center py-6 sm:py-10 lg:py-12 gap-6 sm:gap-8 lg:gap-12"
    >
      {/* Left Content */}
      <div className="lg:col-span-3 space-y-5 sm:space-y-6 lg:space-y-8">
        <div
          className="flex max-w-3xl items-start gap-3 rounded-lg border-2 border-black bg-[#FFF7ED] px-4 py-3 text-left shadow-[4px_4px_0_rgba(0,0,0,0.12)] sm:px-5 sm:py-4"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#C2410C]" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold leading-snug text-black sm:text-base">
              {heroMessages.shutdownNotice.title}
            </p>
            <p className="text-sm leading-relaxed text-[#4A3A2A] sm:text-[15px]">
              {heroMessages.shutdownNotice.body}
            </p>
          </div>
        </div>

        {/* Top Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <BlackFridayBadge />
          <a
            href="#model-pricing"
            aria-label="View model pricing"
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
          >
            <LiveModelBadge
              icon={<Kling className="w-3.5 h-3.5 text-[#37352f]" />}
              label={heroMessages.badges.klingLive}
            />
          </a>
          <a
            href="#model-pricing"
            aria-label="View model pricing"
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
          >
            <LiveModelBadge
              icon={<Kling className="w-3.5 h-3.5 text-[#37352f]" />}
              label={heroMessages.badges.klingMotionLive}
            />
          </a>
          <a
            href="#model-pricing"
            aria-label="View model pricing"
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
          >
            <LiveModelBadge
              icon={<Google className="w-3.5 h-3.5 text-[#37352f]" />}
              label={heroMessages.badges.gptImage2Live}
            />
          </a>
        </div>

        <h1 className="text-[34px] sm:text-5xl lg:text-6xl font-bold text-black leading-[1.08] tracking-[-0.02em]">
          {heroMessages.title.split(heroMessages.titleHighlight)[0]}
          <span className="underline decoration-[#E5E5E5] underline-offset-8">
            {heroMessages.titleHighlight}
          </span>{" "}
          {heroMessages.title.split(heroMessages.titleHighlight)[1]}
        </h1>

        <p className="text-base sm:text-xl text-[#666666] leading-relaxed max-w-lg">
          {heroMessages.description}
        </p>

        {/* Selling points */}
        <div className="mt-4 space-y-3 text-[#666666] text-[15px] sm:text-[16px]">
          {heroMessages.bullets.map((item) => (
            <div key={item} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-black mt-0.5 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 w-full">
          <TikTokInputHero />
          {/* Discord Community Button */}
          <a
            href="https://discord.gg/gStwqdpRzt"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-press-button landing-press-button--discord h-14 w-full text-lg font-semibold sm:w-auto"
            title={heroMessages.discordTitle}
          >
            <SiDiscord className="w-5 h-5" />
            <span className="whitespace-nowrap">{heroMessages.discordJoin}</span>
          </a>
        </div>

        <SocialProofBadge />
      </div>

      {/* Right Demo - Comparison Layout */}
      <div className="lg:col-span-2 flex flex-col items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-[480px]">
          {/* Reference Video */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {heroMessages.referenceVideo}
              </div>
            </div>
            <div className="relative aspect-[9/16] bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,0.05)] border border-[#E5E5E5]">
              <LazyVideoPlayer
                wrapperClassName="w-full h-full"
                className="w-full h-full object-cover"
                src={`${SITE_ASSET_BASE_URL}/landing/clone_reference.mp4`}
                ariaLabel={heroMessages.referenceVideoAriaLabel}
                analyticsName="hero_reference_video"
                autoPlay
                loop
                playsInline
              />

              {/* TikTok-style Social Overlays */}
              <div className="absolute right-2 bottom-12 flex flex-col items-center gap-3 text-white">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full">
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </div>
                  <span className="text-[10px] font-bold drop-shadow-md">
                    59.8K
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full">
                    <MessageCircle className="w-4 h-4 fill-white text-white" />
                  </div>
                  <span className="text-[10px] font-bold drop-shadow-md">
                    1077
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full">
                    <Share2 className="w-4 h-4 fill-white text-white" />
                  </div>
                  <span className="text-[10px] font-bold drop-shadow-md">
                    12.5K
                  </span>
                </div>
              </div>

              <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white">
                <Eye className="w-3 h-3 drop-shadow-md" />
                  <span className="text-[10px] font-bold drop-shadow-md">
                    8.5M {heroMessages.views}
                  </span>
              </div>
            </div>
          </div>

          {/* Result Video */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-black text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-white fill-white" />
                {heroMessages.cloneResult}
              </div>
            </div>
            <div className="relative aspect-[9/16] bg-[#F1F1F1] rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)] border-2 border-black">
              <LazyVideoPlayer
                wrapperClassName="w-full h-full"
                className="w-full h-full object-cover"
                src={`${SITE_ASSET_BASE_URL}/landing/clone_result.mp4`}
                ariaLabel={heroMessages.resultVideoAriaLabel}
                analyticsName="hero_result_video"
                autoPlay
                loop
                playsInline
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
