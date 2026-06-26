"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Coins, Loader2, MessageSquareWarning } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FeedbackDialog from "@/components/feedback/FeedbackDialog";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";

type ToolStatusTone = "credits" | "warning" | "loading" | "free";

type ToolPageShellProps = {
  eyebrow?: string;
  title: ReactNode;
  titleBadge?: ReactNode;
  description: ReactNode;
  statusLabel: ReactNode;
  statusTone?: ToolStatusTone;
  statusHelper?: ReactNode;
  toolSlug?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function ToolPageShell({
  eyebrow = "Tools",
  title,
  titleBadge,
  description,
  statusLabel,
  statusTone = "credits",
  statusHelper,
  toolSlug,
  children,
  className,
  contentClassName,
}: ToolPageShellProps) {
  const isWarning = statusTone === "warning";
  const isLoading = statusTone === "loading";
  const { messages } = useI18n();
  const feedbackCopy = messages.landing.feedback;
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <section className={cn("mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 md:py-14", className)}>
          <div className="flex flex-col gap-6 border-b border-[#E5E5E5] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">{eyebrow}</p>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-5xl">{title}</h1>
                {titleBadge ? (
                  <span className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 sm:mt-2">
                    {titleBadge}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#666666]">{description}</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 lg:items-end">
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                aria-label={feedbackCopy.triggerLabel}
                className="group flex min-w-[210px] items-center justify-center gap-3 self-end rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-5 py-4 text-left text-black transition-all duration-150 hover:border-black hover:bg-white"
              >
                <MessageSquareWarning className="h-9 w-9 shrink-0 text-[#333333] transition-colors group-hover:text-black" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xl font-semibold leading-none tracking-tight sm:text-2xl">
                    {feedbackCopy.triggerLabel}
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#666666]">
                    {feedbackCopy.triggerHelper}
                  </div>
                </div>
              </button>
              <div
                className={cn(
                  "flex min-h-[76px] min-w-[210px] items-center justify-center gap-3 rounded-lg border px-5 py-4 text-black",
                  isWarning ? "border-amber-200 bg-amber-50" : "border-[#E5E5E5] bg-[#F7F7F7]"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-9 w-9 animate-spin" aria-hidden="true" />
                ) : isWarning ? (
                  <AlertTriangle className="h-9 w-9 text-amber-600 drop-shadow-[0_0_9px_rgba(245,158,11,0.55)]" aria-hidden="true" />
                ) : (
                  <Coins className="h-9 w-9" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <div
                    className={cn(
                      "font-semibold leading-none tracking-tight",
                      statusTone === "credits" ? "font-mono text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
                    )}
                  >
                    {statusLabel}
                  </div>
                  {statusHelper ? <div className="mt-1 text-xs font-medium text-[#666666]">{statusHelper}</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className={cn("space-y-6 py-8", contentClassName)}>{children}</div>
        </section>
      </main>
      <Footer />
      <FeedbackDialog
        variant="general_feedback"
        source={`tool_page:${toolSlug ?? "unknown"}`}
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
      />
    </>
  );
}
