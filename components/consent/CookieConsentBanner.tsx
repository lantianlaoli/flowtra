"use client";

import Link from "next/link";
import { Check, Cookie, X } from "lucide-react";

interface CookieConsentBannerProps {
  onAcceptAll: () => void;
  onRejectNonEssential: () => void;
  onManagePreferences: () => void;
}

export function CookieConsentBanner({
  onAcceptAll,
  onRejectNonEssential,
  onManagePreferences,
}: CookieConsentBannerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[110] px-4 pb-4 sm:px-6 sm:pb-5">
      <div className="mx-auto max-w-[1040px] rounded-[28px] border border-[#E5E5E5] bg-white px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.14)] sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[680px]">
            <p className="text-[15px] font-semibold leading-6 text-black">
              We use cookies to keep Flowtra secure and to understand how the site is used.
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#666666]">
              Necessary cookies are always on. Optional analytics cookies help us improve
              product performance and user experience. See our{" "}
              <Link href="/privacy" className="font-medium text-black underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-2 lg:flex-shrink-0">
            <button
              type="button"
              className="landing-press-button landing-press-button--secondary h-14 w-14 px-0 text-black"
              onClick={onManagePreferences}
              aria-label="Manage cookie preferences"
              title="Manage cookie preferences"
            >
              <Cookie size={34} strokeWidth={2.2} className="shrink-0 text-[#111111]" />
            </button>
            <button
              type="button"
              className="landing-press-button landing-press-button--secondary landing-press-button--compact text-[14px] font-medium"
              onClick={onRejectNonEssential}
            >
              <X className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              className="landing-press-button landing-press-button--compact text-[14px] font-medium"
              onClick={onAcceptAll}
            >
              <Check className="h-4 w-4" />
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
