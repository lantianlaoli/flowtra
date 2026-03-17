"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";
import {
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  Bot,
  UserCircle,
  Copy,
  RefreshCw,
  Upload,
  Calculator,
  Sparkles,
  LayoutDashboard,
  Moon,
  Sun,
} from "lucide-react";

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

interface HeaderProps {
  showAuthButtons?: boolean;
  showThemeToggle?: boolean;
}

export default function Header({
  showAuthButtons = true,
  showThemeToggle = true,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const navButtonClass =
    "landing-press-button landing-press-button--secondary landing-press-button--compact landing-nav-button text-[14px] font-medium";

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setCompact(y > 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("flowtra-dashboard-dark");
    const enabled = stored === null ? true : stored === "true";
    setIsDarkMode(enabled);
    document.documentElement.classList.toggle("dashboard-theme", enabled);
    document.body.classList.toggle("dashboard-theme", enabled);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dashboard-theme", isDarkMode);
    document.body.classList.toggle("dashboard-theme", isDarkMode);
    window.localStorage.setItem(
      "flowtra-dashboard-dark",
      isDarkMode.toString(),
    );
    window.dispatchEvent(
      new CustomEvent("flowtra-dashboard-theme-change", { detail: isDarkMode }),
    );
  }, [isDarkMode]);

  const toggleDarkMode = (trigger?: HTMLElement) => {
    const nextValue = !isDarkMode;
    const applyTheme = () => {
      setIsDarkMode(nextValue);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("flowtra-dashboard-dark", String(nextValue));
        document.documentElement.classList.toggle("dashboard-theme", nextValue);
        document.body.classList.toggle("dashboard-theme", nextValue);
        window.dispatchEvent(
          new CustomEvent("flowtra-dashboard-theme-change", { detail: nextValue }),
        );
      }
    };

    if (typeof window !== "undefined") {
      const transitionDocument = document as ViewTransitionCapableDocument;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prefersReducedMotion && transitionDocument.startViewTransition && trigger) {
        const rect = trigger.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );

        const transition = transitionDocument.startViewTransition(() => {
          applyTheme();
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 700,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        }).catch(() => {});
        return;
      }
    }

    applyTheme();
  };

  return (
    <header
      className={`sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4 lg:px-6 transition-all duration-300 ${
        compact ? "pb-1.5" : "pb-2"
      }`}
    >
      <div
        className={`mx-auto flex w-full max-w-[1280px] items-center rounded-[28px] border border-[#E5E5E5] bg-white/92 px-4 sm:px-6 lg:px-7 backdrop-blur-xl transition-all duration-300 ${
          compact
            ? "min-h-[62px] shadow-[0_12px_30px_rgba(0,0,0,0.07)]"
            : "min-h-[70px] shadow-[0_18px_44px_rgba(0,0,0,0.06)]"
        }`}
      >
        <div className="flex items-center justify-start">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-[20px] px-1 py-1 transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo.svg"
              alt="Flowtra AI Logo"
              width={95}
              height={95}
              className="logo-theme h-[52px] w-[52px] sm:h-[58px] sm:w-[58px]"
            />
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-4 lg:gap-6">
          <nav
            className="hidden md:flex items-center gap-2"
            aria-label="Main navigation"
          >
            {/* Features Dropdown */}
            <div className="relative group">
              <button className={`${navButtonClass} gap-1`}>
                Features
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </button>
              <div className="landing-floating-panel absolute left-1/2 top-full z-50 mt-4 w-64 -translate-x-1/2 rounded-[24px] border border-[#E5E5E5] bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.12)] invisible opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="py-2">
                  <Link
                    href="/features/ai-agent"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <Bot className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-black">AI Agent</div>
                        <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                          New
                        </span>
                      </div>
                      <div className="text-[12px] opacity-70">
                        Talk through clone workflows
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/features/avatar-ads"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <UserCircle className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">Avatar Ads</div>
                      <div className="text-[12px] opacity-70">
                        AI character-driven videos
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/features/viral-clone"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <Copy className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        Viral Clone
                      </div>
                      <div className="text-[12px] opacity-70">
                        Clone viral videos
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/features/motion-clone"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <RefreshCw className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        Motion Clone
                      </div>
                      <div className="text-[12px] opacity-70">
                        Clone viral ad movements
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <div className="relative group">
              <button className={`${navButtonClass} gap-1`}>
                Tools
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </button>
              <div className="landing-floating-panel absolute left-1/2 top-full z-50 mt-4 w-64 -translate-x-1/2 rounded-[24px] border border-[#E5E5E5] bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.12)] invisible opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="py-2">
                  <Link
                    href="/tools/upload-assets"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <Upload className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        Upload Assets to URL
                      </div>
                      <div className="text-[12px] opacity-70">
                        Video and image upload tools
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/tools/roas-calculator"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <Calculator className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        ROAS Calculator
                      </div>
                      <div className="text-[12px] opacity-70">
                        Measure profitability and break-even goals
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/tools/ai-angle-generator"
                    className="flex items-start gap-3 rounded-[18px] px-4 py-3 text-[14px] text-[#666666] transition-colors hover:bg-[#F7F7F7] hover:text-black"
                  >
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F7F7F7]">
                      <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        AI Multi-Angle Photo
                      </div>
                      <div className="text-[12px] opacity-70">
                        Generate 3 additional viewing angles
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <Link
              href="/#pricing"
              className={navButtonClass}
            >
              Pricing
            </Link>
            <Link
              href="/#blog"
              className={navButtonClass}
            >
              Blog
            </Link>
            <Link
              href="/#faq"
              className={navButtonClass}
            >
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <SignedIn>
              <Link
                href="/dashboard"
                className="landing-press-button landing-press-button--compact inline-flex items-center justify-center text-[14px] font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </SignedIn>
            {showAuthButtons && (
              <>
                <SignedOut>
                  <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                    <button className="landing-press-button landing-press-button--compact inline-flex items-center justify-center px-3 text-[12px] font-medium sm:px-5 sm:text-[14px]">
                      <span className="hidden sm:inline">
                        Sign up · Get 100 free credits
                      </span>
                      <span className="sm:hidden">Get 100 Credits</span>
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              className="rounded-[16px] p-2 text-black transition-colors hover:bg-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>

            {showThemeToggle && (
              <button
                type="button"
                onClick={(event) => toggleDarkMode(event.currentTarget)}
                aria-label="Toggle light and dark mode"
                className={`landing-theme-toggle landing-press-button landing-press-button--secondary landing-press-button--compact h-12 w-12 px-0 ${
                  isDarkMode ? "text-[#F3F7FD]" : "text-[#333333]"
                }`}
              >
                {isDarkMode ? (
                  <Sun className="h-[22px] w-[22px] shrink-0" strokeWidth={2.5} />
                ) : (
                  <Moon className="h-[22px] w-[22px] shrink-0" strokeWidth={2.5} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu - Simplified */}
      <div
        className={`absolute left-0 top-full w-full px-3 sm:px-5 lg:px-6 transition-all duration-300 md:hidden ${
          mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="mx-auto mt-2 flex w-full max-w-[1280px] flex-col gap-4 rounded-[28px] border border-[#E5E5E5] bg-white px-5 py-6 shadow-[0_20px_52px_rgba(0,0,0,0.08)]">
          <Link
            href="/features/ai-agent"
            className="inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span>AI Agent</span>
            <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              New
            </span>
          </Link>
          <Link
            href="/features/avatar-ads"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Avatar Ads
          </Link>
          <Link
            href="/features/viral-clone"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Viral Clone
          </Link>
          <Link
            href="/features/motion-clone"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Motion Clone
          </Link>
          <div className="text-[12px] font-medium text-[#666666] uppercase tracking-[0.2em]">
            Tools
          </div>
          <Link
            href="/tools/upload-assets"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Upload Assets to URL
          </Link>
          <Link
            href="/tools/roas-calculator"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            ROAS Calculator
          </Link>
          <Link
            href="/tools/ai-angle-generator"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            AI Multi-Angle Photo
          </Link>
          <Link
            href="/#pricing"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/#blog"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Blog
          </Link>
        </div>
      </div>
    </header>
  );
}
