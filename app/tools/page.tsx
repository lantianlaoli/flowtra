"use client";

import Link from "next/link";
import {
  BellRing,
  Calculator,
  Presentation,
  Rotate3D,
  ScanSearch,
  Sparkles,
  Store,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useI18n } from "@/providers/I18nProvider";
import { trackLandingToolClick } from "@/lib/analytics/landing-tools";

const TOOL_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/tools/upload-assets": UploadCloud,
  "/tools/roas-calculator": Calculator,
  "/tools/ai-angle-generator": Rotate3D,
  "/tools/image-clone": ScanSearch,
  "/tools/ecommerce-listing-studio": Store,
  "/tools/social-cover-generator": Presentation,
  "/tools/codex-quota-reset-alerts": BellRing,
};
const FREE_TOOL_HREFS = new Set(["/tools/upload-assets", "/tools/roas-calculator"]);

export default function ToolsPage() {
  const { messages } = useI18n();
  const toolsMessages = messages.tools.index;
  const tools = toolsMessages.items.map((item) => ({
    ...item,
    icon: TOOL_ICON_BY_HREF[item.href] ?? Sparkles,
    isFree: FREE_TOOL_HREFS.has(item.href),
  }));

  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[980px] px-4 sm:px-6 py-14 md:py-20">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">{toolsMessages.eyebrow}</p>
            <h1 className="text-3xl sm:text-5xl font-semibold text-black tracking-tight">{toolsMessages.title}</h1>
            <p className="max-w-2xl text-base text-[#666666]">
              {toolsMessages.description}
            </p>
          </div>

          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-5 sm:grid-cols-2">
            {tools.map(({ href, title, description, icon: Icon, isFree }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_70px_rgba(0,0,0,0.1)]"
                onClick={() => trackLandingToolClick(href, "tools_index_card")}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <div className="mt-5 flex items-start gap-2">
                  <h2 className="text-xl font-semibold text-black">{title}</h2>
                  {isFree ? (
                    <span className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                      Free
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[#666666]">{description}</p>
                <span className="mt-5 inline-flex text-sm font-medium text-black group-hover:underline">
                  {toolsMessages.openTool}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
