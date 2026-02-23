import Link from "next/link";
import { Calculator, Sparkles, Upload } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const tools = [
  {
    href: "/tools/upload-assets",
    title: "Upload Assets to URL",
    description: "Upload image or video files and generate a temporary download URL.",
    icon: Upload,
  },
  {
    href: "/tools/roas-calculator",
    title: "ROAS Calculator",
    description: "Calculate ROAS, net profit, margin, and conversion-level ad performance.",
    icon: Calculator,
  },
  {
    href: "/tools/ai-angle-generator",
    title: "AI Multi-Angle Photo",
    description: "Upload one frontal photo and generate 3 additional viewing angles.",
    icon: Sparkles,
  },
];

export default function ToolsPage() {
  return (
    <>
      <Header />
      <main className="bg-white">
        <section className="mx-auto max-w-[980px] px-4 sm:px-6 py-14 md:py-20">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#666666]">Tools</p>
            <h1 className="text-3xl sm:text-5xl font-semibold text-black tracking-tight">Marketing Utilities</h1>
            <p className="max-w-2xl text-base text-[#666666]">
              Fast tools for campaign operations and performance analysis.
            </p>
          </div>

          <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-5 sm:grid-cols-2">
            {tools.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_70px_rgba(0,0,0,0.1)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7]">
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-black">{title}</h2>
                <p className="mt-2 text-sm text-[#666666]">{description}</p>
                <span className="mt-5 inline-flex text-sm font-medium text-black group-hover:underline">
                  Open tool
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
