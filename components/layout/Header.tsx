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
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/providers/I18nProvider";

interface HeaderProps {
  showAuthButtons?: boolean;
}

type HeaderNavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  isNew?: boolean;
};

const FEATURE_ICONS: LucideIcon[] = [Bot, UserCircle, Copy, RefreshCw];
const TOOL_ICONS: LucideIcon[] = [Upload, Calculator, Sparkles];

function HeaderMenuItem({
  href,
  title,
  icon: Icon,
  isNew = false,
  badgeLabel = "New",
  onClick,
}: HeaderNavItem & { onClick?: () => void; badgeLabel?: string }) {
  return (
    <Link
      href={href}
      className="landing-dropdown-item landing-press-button landing-press-button--secondary landing-press-button--compact"
      onClick={onClick}
    >
      <div className="landing-dropdown-item__icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="landing-dropdown-item__title">{title}</div>
          {isNew ? (
            <span className="landing-dropdown-item__badge">
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function Header({
  showAuthButtons = true,
}: HeaderProps) {
  const { messages } = useI18n();
  const headerMessages = messages.landing.header;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  const featureItems: HeaderNavItem[] = headerMessages.featureItems.map((item, index) => ({
    ...item,
    icon: FEATURE_ICONS[index] ?? Bot,
  }));

  const toolItems: HeaderNavItem[] = headerMessages.toolItems.map((item, index) => ({
    ...item,
    icon: TOOL_ICONS[index] ?? Sparkles,
  }));

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
            aria-label={headerMessages.mainNavLabel}
          >
            <div className="relative group">
              <button className={`${navButtonClass} gap-1`}>
                {headerMessages.features}
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </button>
              <div className="landing-floating-panel absolute left-1/2 top-full z-50 mt-4 min-w-[15.5rem] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[22px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.12)] invisible opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="flex flex-col gap-2 py-2">
                  {featureItems.map((item) => (
                    <HeaderMenuItem
                      key={item.href}
                      {...item}
                      badgeLabel={messages.landing.features.newBadge}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="relative group">
              <button className={`${navButtonClass} gap-1`}>
                {headerMessages.tools}
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </button>
              <div className="landing-floating-panel absolute left-1/2 top-full z-50 mt-4 min-w-[15.5rem] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[22px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.12)] invisible opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="flex flex-col gap-2 py-2">
                  {toolItems.map((item) => (
                    <HeaderMenuItem key={item.href} {...item} />
                  ))}
                </div>
              </div>
            </div>
            <Link href="/#pricing" className={navButtonClass}>
              {headerMessages.pricing}
            </Link>
            <Link href="/#blog" className={navButtonClass}>
              {headerMessages.blog}
            </Link>
            <Link href="/#faq" className={navButtonClass}>
              {headerMessages.faq}
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <SignedIn>
              <Link
                href="/dashboard"
                className="landing-press-button landing-press-button--compact inline-flex items-center justify-center text-[14px] font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                {headerMessages.dashboard}
              </Link>
            </SignedIn>
            {showAuthButtons ? (
              <>
                <SignedOut>
                  <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                    <button className="landing-press-button landing-press-button--compact inline-flex items-center justify-center px-3 text-[12px] font-medium sm:px-5 sm:text-[14px]">
                      <span className="hidden sm:inline">{headerMessages.signUpDesktop}</span>
                      <span className="sm:hidden">{headerMessages.signUpMobile}</span>
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </>
            ) : null}

            <button
              type="button"
              className="rounded-[16px] p-2 text-black transition-colors hover:bg-white md:hidden"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label={headerMessages.mobileMenuLabel}
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`absolute left-0 top-full w-full px-3 sm:px-5 lg:px-6 transition-all duration-300 md:hidden ${
          mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="mx-auto mt-2 flex w-full max-w-[1280px] flex-col gap-4 rounded-[28px] border border-[#E5E5E5] bg-white px-5 py-6 shadow-[0_20px_52px_rgba(0,0,0,0.08)]">
          {featureItems.map((item) => (
            <HeaderMenuItem
              key={item.href}
              {...item}
              badgeLabel={messages.landing.features.newBadge}
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}
          <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-[#666666]">
            {headerMessages.tools}
          </div>
          {toolItems.map((item) => (
            <HeaderMenuItem
              key={item.href}
              {...item}
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}
          <Link
            href="/#pricing"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            {headerMessages.pricing}
          </Link>
          <Link
            href="/#blog"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            {headerMessages.blog}
          </Link>
          <Link
            href="/#faq"
            className="rounded-[18px] px-3 py-2 text-[16px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            onClick={() => setMobileMenuOpen(false)}
          >
            {headerMessages.faq}
          </Link>
        </div>
      </div>
    </header>
  );
}
