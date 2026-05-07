"use client";

import Link from "next/link";
import { Calculator, Sparkles, Upload } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useI18n } from "@/providers/I18nProvider";
import { trackLandingToolClick } from "@/lib/analytics/landing-tools";

export default function ToolsPage() {
  const { messages } = useI18n();
  const toolsMessages = messages.tools.index;
  const tools = toolsMessages.items.map((item) => ({
    ...item,
    icon:
      item.href === "/tools/upload-assets"
        ? Upload
        : item.href === "/tools/roas-calculator"
          ? Calculator
          : Sparkles,
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
            {tools.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_70px_rgba(0,0,0,0.1)]"
                onClick={() => trackLandingToolClick(href, "tools_index_card")}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-black">{title}</h2>
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
