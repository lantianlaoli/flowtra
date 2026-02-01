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
  UserCircle,
  Copy,
  RefreshCw,
  Upload,
  LayoutDashboard,
  Moon,
  Sun,
} from "lucide-react";

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
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dashboard-theme", isDarkMode);
    window.localStorage.setItem(
      "flowtra-dashboard-dark",
      isDarkMode.toString(),
    );
    window.dispatchEvent(
      new CustomEvent("flowtra-dashboard-theme-change", { detail: isDarkMode }),
    );
  }, [isDarkMode]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E5E5] h-[72px] sm:h-[80px] flex items-center">
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
            <button className="text-[14px] font-medium text-[#666666] hover:text-black transition-colors flex items-center gap-1">
              Features
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-64 bg-white border border-[#E5E5E5] rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <Link
                  href="/features/avatar-ads"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5">
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
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5">
                    <Copy className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-black">Viral Clone</div>
                    <div className="text-[12px] opacity-70">
                      Clone viral videos
                    </div>
                  </div>
                </Link>
                <Link
                  href="/features/motion-swap"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5">
                    <RefreshCw className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-black">Motion Swap</div>
                    <div className="text-[12px] opacity-70">
                      Clone viral ad movements
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <div className="relative group">
            <button className="text-[14px] font-medium text-[#666666] hover:text-black transition-colors flex items-center gap-1">
              Tools
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-64 bg-white border border-[#E5E5E5] rounded-lg shadow-[0_20px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-2">
                <Link
                  href="/tools/upload-assets"
                  className="flex items-start gap-3 px-4 py-3 text-[14px] text-[#666666] hover:bg-[#F7F7F7] hover:text-black transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-[#F7F7F7] rounded-lg flex items-center justify-center mt-0.5">
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
              </div>
            </div>
          </div>
          <Link
            href="/#pricing"
            className="text-[14px] font-medium text-[#666666] hover:text-black transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/#blog"
            className="text-[14px] font-medium text-[#666666] hover:text-black transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/#faq"
            className="text-[14px] font-medium text-[#666666] hover:text-black transition-colors"
          >
            FAQ
          </Link>
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-4 ml-auto">
          <SignedIn>
            <Link
              href="/dashboard"
              className="border border-[#E5E5E5] bg-white text-[#666666] hover:text-black hover:border-black px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </SignedIn>
          {showAuthButtons && (
            <>
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="bg-black text-white text-[14px] font-medium px-6 py-2.5 rounded-lg hover:bg-[#333333] transition-all cursor-pointer">
                    Get Started
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
            className="md:hidden p-2 text-black"
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
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label="Toggle light and dark mode"
              className="border border-[#E5E5E5] bg-white text-[#666666] hover:text-black hover:border-black px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span>{isDarkMode ? "Light" : "Dark"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu - Simplified */}
      <div
        className={`md:hidden absolute top-full left-0 w-full bg-white border-b border-[#E5E5E5] transition-all duration-300 ${
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="px-4 py-6 flex flex-col gap-4">
          <Link
            href="/features/avatar-ads"
            className="text-[16px] font-medium text-black"
            onClick={() => setMobileMenuOpen(false)}
          >
            Avatar Ads
          </Link>
          <Link
            href="/features/viral-clone"
            className="text-[16px] font-medium text-black"
            onClick={() => setMobileMenuOpen(false)}
          >
            Viral Clone
          </Link>
          <Link
            href="/features/motion-swap"
            className="text-[16px] font-medium text-black"
            onClick={() => setMobileMenuOpen(false)}
          >
            Motion Swap
          </Link>
          <div className="text-[12px] font-medium text-[#666666] uppercase tracking-[0.2em]">
            Tools
          </div>
          <Link
            href="/tools/upload-assets"
            className="text-[16px] font-medium text-black"
            onClick={() => setMobileMenuOpen(false)}
          >
            Upload Assets to URL
          </Link>
          <Link
            href="/#pricing"
            className="text-[16px] font-medium text-black"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/#blog"
            className="text-[16px] font-medium text-black"
            onClick={() => setMobileMenuOpen(false)}
          >
            Blog
          </Link>
        </div>
      </div>
    </header>
  );
}
