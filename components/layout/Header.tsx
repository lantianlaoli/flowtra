"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";
import {
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { UserCircle, Copy, RefreshCw, Upload, Moon, Sun } from "lucide-react";

interface HeaderProps {
  showAuthButtons?: boolean;
  showThemeToggle?: boolean;
}

export default function Header({ showAuthButtons = true, showThemeToggle = true }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname?.startsWith("/dashboard")) {
      document.documentElement.classList.remove("dark");
      return;
    }
    const stored = window.localStorage.getItem("flowtra-landing-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    const next = stored ? stored === "dark" : prefersDark;
    setIsDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname?.startsWith("/dashboard")) {
      document.documentElement.classList.remove("dark");
      return;
    }
    window.localStorage.setItem("flowtra-landing-theme", isDarkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode, pathname]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setCompact(y > 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E5E5] dark:bg-[#0b0f16] dark:border-[#1f2937] h-[72px] sm:h-[80px] flex items-center">
      <div className="mx-auto max-w-[1280px] w-full px-4 sm:px-6 lg:px-8 flex items-center">
        {/* Logo - Left */}
        <div className="flex items-center justify-start">
          <Link
            href="/"
            className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo.svg"
              alt="Flowtra AI Logo"
              width={95}
              height={95}
              className="logo-theme w-[95px] h-[95px]"
            />
          </Link>
        </div>

        {/* Links - Center */}
        <nav
          className="hidden md:flex items-center gap-6 ml-auto mr-6"
          aria-label="Main navigation"
        >
          {/* Features Dropdown */}
          <div className="relative group">
            <button className="text-[14px] font-medium text-[#666666] hover:text-black dark:text-[#cbd5e1] dark:hover:text-white transition-colors flex items-center gap-1">
              Features
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-64 bg-white border border-[#E5E5E5] dark:bg-[#0b0f16] dark:border-[#1f2937] rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <Link
                  href="/features/avatar-ads"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black dark:text-[#cbd5e1] dark:hover:bg-[#111827] dark:hover:text-white transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5 dark:bg-[#111827]">
                    <UserCircle className="w-5 h-5 text-black dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-black dark:text-white">Avatar Ads</div>
                    <div className="text-[12px] opacity-70 dark:opacity-80">
                      AI character-driven videos
                    </div>
                  </div>
                </Link>
                <Link
                  href="/features/viral-clone"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black dark:text-[#cbd5e1] dark:hover:bg-[#111827] dark:hover:text-white transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5 dark:bg-[#111827]">
                    <Copy className="w-5 h-5 text-black dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-black dark:text-white">
                      Viral Clone
                    </div>
                    <div className="text-[12px] opacity-70 dark:opacity-80">
                      Clone viral videos
                    </div>
                  </div>
                </Link>
                <Link
                  href="/features/motion-swap"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black dark:text-[#cbd5e1] dark:hover:bg-[#111827] dark:hover:text-white transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5 dark:bg-[#111827]">
                    <RefreshCw className="w-5 h-5 text-black dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-black dark:text-white">Motion Swap</div>
                    <div className="text-[12px] opacity-70 dark:opacity-80">
                      Clone viral ad movements
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <div className="relative group">
            <button className="text-[14px] font-medium text-[#666666] hover:text-black dark:text-[#cbd5e1] dark:hover:text-white transition-colors flex items-center gap-1">
              Tools
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-64 bg-white border border-[#E5E5E5] dark:bg-[#0b0f16] dark:border-[#1f2937] rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <Link
                  href="/tools/upload-assets"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black dark:text-[#cbd5e1] dark:hover:bg-[#111827] dark:hover:text-white transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5 dark:bg-[#111827]">
                    <Upload className="w-5 h-5 text-black dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-black dark:text-white">Upload Assets to URL</div>
                    <div className="text-[12px] opacity-70 dark:opacity-80">
                      Video and image upload tools
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <Link
            href="/#pricing"
            className="text-[14px] font-medium text-[#666666] hover:text-black dark:text-[#cbd5e1] dark:hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/#blog"
            className="text-[14px] font-medium text-[#666666] hover:text-black dark:text-[#cbd5e1] dark:hover:text-white transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/#faq"
            className="text-[14px] font-medium text-[#666666] hover:text-black dark:text-[#cbd5e1] dark:hover:text-white transition-colors"
          >
            FAQ
          </Link>
        </nav>

        {/* Auth Buttons - Right */}
        <div className="flex items-center gap-4 ml-auto">
          {showAuthButtons && (
            <>
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="bg-black text-white text-[14px] font-medium px-6 py-2.5 rounded-lg hover:bg-[#333333] transition-all cursor-pointer dark:bg-white dark:text-black dark:hover:bg-[#e5e7eb]">
                    Get Started
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="bg-black text-white text-[14px] font-medium px-6 py-2.5 rounded-lg hover:bg-[#333333] transition-all dark:bg-white dark:text-black dark:hover:bg-[#e5e7eb]"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          )}

          {showThemeToggle && (
            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label="Toggle light and dark mode"
              className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#666666] transition-colors hover:border-black hover:text-black dark:border-[#1f2937] dark:bg-[#0b0f16] dark:text-[#e5e7eb] dark:hover:border-[#334155]"
            >
              {isDarkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              <span>{isDarkMode ? "Dark" : "Light"}</span>
            </button>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 text-black dark:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu - Simplified */}
      <div
        className={`md:hidden absolute top-full left-0 w-full bg-white border-b border-[#E5E5E5] dark:bg-[#0b0f16] dark:border-[#1f2937] transition-all duration-300 ${
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="px-4 py-6 flex flex-col gap-4">
          <Link
            href="/features/avatar-ads"
            className="text-[16px] font-medium text-black dark:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Avatar Ads
          </Link>
          <Link
            href="/features/viral-clone"
            className="text-[16px] font-medium text-black dark:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Viral Clone
          </Link>
          <Link
            href="/features/motion-swap"
            className="text-[16px] font-medium text-black dark:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Motion Swap
          </Link>
          <div className="text-[12px] font-medium text-[#666666] dark:text-[#94a3b8] uppercase tracking-[0.2em]">
            Tools
          </div>
          <Link
            href="/tools/upload-assets"
            className="text-[16px] font-medium text-black dark:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Upload Assets to URL
          </Link>
          <Link
            href="/#pricing"
            className="text-[16px] font-medium text-black dark:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/#blog"
            className="text-[16px] font-medium text-black dark:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Blog
          </Link>
        </div>
      </div>
    </header>
  );
}
