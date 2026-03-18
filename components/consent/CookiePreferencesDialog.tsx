"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, ShieldCheck, ChartColumn, SlidersHorizontal, X } from "lucide-react";

interface CookiePreferencesDialogProps {
  open: boolean;
  analytics: boolean;
  onAnalyticsChange: (value: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onAcceptAll: () => void;
  onRejectNonEssential: () => void;
}

function ConsentToggle({
  checked,
  onCheckedChange,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={`relative inline-flex h-8 w-14 items-center overflow-hidden rounded-full border border-[#D7D7D7] p-1 transition-all ${
        checked
          ? "bg-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "bg-[#F1F1F1]"
      } ${disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-6 w-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function CookiePreferencesDialog({
  open,
  analytics,
  onAnalyticsChange,
  onOpenChange,
  onSave,
  onAcceptAll,
  onRejectNonEssential,
}: CookiePreferencesDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[130] w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#E5E5E5] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.18)] sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[24px] font-semibold tracking-[-0.02em] text-black">
                Cookie preferences
              </Dialog.Title>
              <Dialog.Description className="mt-2 max-w-[500px] text-[14px] leading-6 text-[#666666]">
                Choose which optional cookies Flowtra can use. Necessary cookies
                stay on so sign-in, security, and core site functions keep working.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#666666] shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition-colors hover:text-black"
                aria-label="Close cookie preferences"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <section className="rounded-[22px] border border-[#E5E5E5] bg-[#FAFAFA] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-black">
                    <ShieldCheck className="h-4 w-4 text-[#111111]" />
                    Necessary cookies
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#666666]">
                    Required for authentication, security, account sessions, and
                    core website functionality.
                  </p>
                </div>
                <div className="flex min-w-[120px] flex-col items-start gap-2 sm:items-end">
                  <ConsentToggle checked={true} disabled />
                  <span className="text-[12px] font-medium text-[#666666]">
                    Always active
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#E5E5E5] bg-[#FAFAFA] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-black">
                    <ChartColumn className="h-4 w-4 text-[#111111]" />
                    Analytics cookies
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#666666]">
                    Allow PostHog, Google Analytics, Vercel Analytics, and
                    Speed Insights so we can measure traffic, diagnose issues,
                    and improve the product.
                  </p>
                </div>
                <div className="flex min-w-[120px] flex-col items-start gap-2 sm:items-end">
                  <ConsentToggle
                    checked={analytics}
                    onCheckedChange={onAnalyticsChange}
                  />
                  <span className="text-[12px] font-medium text-[#666666]">
                    Optional
                  </span>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[#EFEFEF] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row">
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
                className="landing-press-button landing-press-button--secondary landing-press-button--compact text-[14px] font-medium"
                onClick={onAcceptAll}
              >
                <Check className="h-4 w-4" />
                Accept all
              </button>
            </div>

            <button
              type="button"
              className="landing-press-button landing-press-button--compact text-[14px] font-medium sm:min-w-[190px]"
              onClick={onSave}
            >
              <SlidersHorizontal className="h-4.5 w-4.5 stroke-[2.2]" />
              Save preferences
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
