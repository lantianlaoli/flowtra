"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
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
  UploadCloud,
  Calculator,
  Sparkles,
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  MessageSquarePlus,
  Rotate3D,
  ScanSearch,
  Store,
  Presentation,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/providers/I18nProvider";
import { trackLandingToolClick } from "@/lib/analytics/landing-tools";
import FeedbackDialog from "@/components/feedback/FeedbackDialog";

interface HeaderProps {
  showAuthButtons?: boolean;
}

type HeaderNavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  isNew?: boolean;
  badgeLabel?: string;
};

const FEATURE_ICONS: LucideIcon[] = [Bot, UserCircle, Copy, RefreshCw];
const TOOL_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/tools/upload-assets": UploadCloud,
  "/tools/roas-calculator": Calculator,
  "/tools/ai-angle-generator": Rotate3D,
  "/tools/image-clone": ScanSearch,
  "/tools/ecommerce-listing-studio": Store,
  "/tools/social-cover-generator": Presentation,
  "#feedback": MessageSquarePlus,
};
const FREE_TOOL_HREFS = new Set(["/tools/upload-assets", "/tools/roas-calculator"]);

function HeaderMenuItem({
  href,
  title,
  icon: Icon,
  isNew = false,
  badgeLabel = "New",
  onClick,
  as = "link",
}: HeaderNavItem & {
  onClick?: () => void;
  badgeLabel?: string;
  as?: "link" | "button";
}) {
  const innerContent = (
    <>
      <div className="landing-dropdown-item__icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="landing-dropdown-item__title">{title}</div>
          {isNew ? (
            <span
              className={
                badgeLabel === "Free"
                  ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700"
                  : "landing-dropdown-item__badge"
              }
            >
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  if (as === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="landing-dropdown-item landing-press-button landing-press-button--secondary landing-press-button--compact w-full text-left"
      >
        {innerContent}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="landing-dropdown-item landing-press-button landing-press-button--secondary landing-press-button--compact"
      onClick={onClick}
    >
      {innerContent}
    </Link>
  );
}

function HeaderMobileTileItem({
  href,
  title,
  icon: Icon,
  isNew = false,
  badgeLabel = "New",
  onClick,
  as = "link",
}: HeaderNavItem & {
  onClick?: () => void;
  badgeLabel?: string;
  as?: "link" | "button";
}) {
  const titleSizeClass =
    title.length > 14
      ? "text-[0.72rem]"
      : title.length > 11
        ? "text-[0.78rem]"
        : "text-[0.84rem]";

  const innerContent = (
    <>
      <Icon className="h-4.5 w-4.5 shrink-0 text-black" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={`leading-tight font-semibold text-black ${titleSizeClass}`}
            title={title}
          >
            {title}
          </div>
          {isNew ? (
            <span
              className={
                badgeLabel === "Free"
                  ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-700"
                  : "landing-dropdown-item__badge"
              }
            >
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  if (as === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="landing-press-button landing-press-button--secondary flex min-h-[82px] items-center gap-2 rounded-[22px] px-2 py-2.5 text-left w-full"
        style={{ boxShadow: "none" }}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className="landing-press-button landing-press-button--secondary flex min-h-[82px] items-center gap-2 rounded-[22px] px-2 py-2.5 text-left"
      style={{ boxShadow: "none" }}
    >
      {innerContent}
    </Link>
  );
}

function DesktopNavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

export default function Header({
  showAuthButtons = true,
}: HeaderProps) {
  const { locale, messages } = useI18n();
  const { isSignedIn } = useUser();
  const headerMessages = messages.landing.header;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const featureItems: HeaderNavItem[] = headerMessages.featureItems.map((item, index) => ({
    ...item,
    icon: FEATURE_ICONS[index] ?? Bot,
  }));

  const mobileFeatureItems: HeaderNavItem[] = featureItems.map((item) => {
    if (item.href === "/features/ai-agent") {
      return { ...item, title: locale === "zh" ? "智能体" : "Agent" };
    }
    if (item.href === "/features/avatar-ads") {
      return { ...item, title: locale === "zh" ? "虚拟人" : "Avatar" };
    }
    if (item.href === "/features/video-clone") {
      return { ...item, title: locale === "zh" ? "视频克隆" : "Video Clone" };
    }
    if (item.href === "/features/motion-clone") {
      return { ...item, title: locale === "zh" ? "动作克隆" : "Motion Clone" };
    }
    return item;
  });

  const toolItems: HeaderNavItem[] = headerMessages.toolItems.map((item) => ({
    ...item,
    icon: TOOL_ICON_BY_HREF[item.href] ?? Sparkles,
    isNew: FREE_TOOL_HREFS.has(item.href),
    badgeLabel: FREE_TOOL_HREFS.has(item.href) ? "Free" : undefined,
  }));

  const mobileToolItems: HeaderNavItem[] = toolItems.map((item) => {
    if (item.href === "/tools/upload-assets") {
      return { ...item, title: locale === "zh" ? "链接上传" : "Upload URL" };
    }
    if (item.href === "/tools/ai-angle-generator") {
      return { ...item, title: locale === "zh" ? "多角度" : "Multi-Angle" };
    }
    if (item.href === "/tools/roas-calculator") {
      return { ...item, title: locale === "zh" ? "ROAS" : "ROAS" };
    }
    if (item.href === "/tools/social-cover-generator") {
      return { ...item, title: locale === "zh" ? "社媒封面" : "Social Cover" };
    }
    return item;
  });

  const mobileMoreItems: HeaderNavItem[] = [
    {
      href: "/select-plan",
      title: headerMessages.pricing,
      icon: Calculator,
    },
    {
      href: "/academy",
      title: locale === "zh" ? "学院" : "Academy",
      icon: BookOpen,
    },
    {
      href: "/blog",
      title: headerMessages.blog,
      icon: Sparkles,
    },
    {
      href: "/#faq",
      title: headerMessages.faq,
      icon: MessageSquare,
    },
  ];

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
    if (!mobileMenuOpen || typeof window === "undefined") {
      return;
    }

    const body = document.body;
    const scrollY = window.scrollY;
    const originalStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = originalStyle.position;
      body.style.top = originalStyle.top;
      body.style.left = originalStyle.left;
      body.style.right = originalStyle.right;
      body.style.width = originalStyle.width;
      body.style.overflow = originalStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-[60] px-3 pt-3 sm:px-5 sm:pt-4 lg:px-6 transition-all duration-300 ${
        compact ? "pb-1.5" : "pb-2"
      }`}
    >
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-[50] bg-black/18 backdrop-blur-[1px] xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="relative mx-auto w-full max-w-[1280px]">
        <div
          className={`relative z-[70] flex w-full items-center rounded-[28px] border border-[#E5E5E5] bg-white/92 px-4 sm:px-6 lg:px-7 backdrop-blur-xl transition-all duration-300 ${
            compact
              ? "min-h-[62px] shadow-[0_12px_30px_rgba(0,0,0,0.07)]"
              : "min-h-[70px] shadow-[0_18px_44px_rgba(0,0,0,0.06)]"
          }`}
        >
          <div className="flex items-center justify-start">
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-[20px] px-1 py-1 transition-opacity hover:opacity-80"
            >
              <Image
                src="/logo.svg"
                alt="Flowtra AI Logo"
                width={95}
                height={95}
                className="logo-theme h-[52px] w-[52px] sm:h-[58px] sm:w-[58px]"
              />
              <span className="hidden origin-left -skew-x-6 text-[1.45rem] font-black leading-none tracking-[-0.04em] text-black sm:inline lg:text-[1.65rem]">
                flowtra
              </span>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-3 sm:gap-4 lg:gap-6">
            <nav
              className="hidden xl:flex items-center gap-2"
              aria-label={headerMessages.mainNavLabel}
            >
              <div className="relative group">
                <button className={`${navButtonClass} gap-1`}>
                  <DesktopNavIcon icon={Sparkles} />
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
                  <DesktopNavIcon icon={Settings} />
                  {headerMessages.tools}
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </button>
                <div className="landing-floating-panel absolute left-1/2 top-full z-50 mt-4 min-w-[15.5rem] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[22px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.12)] invisible opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="flex flex-col gap-2 py-2">
                    {toolItems.map((item) =>
                      item.href === "#feedback" ? (
                        <HeaderMenuItem
                          key={item.href}
                          {...item}
                          as="button"
                          onClick={() => {
                            trackLandingToolClick(item.href, "landing_header_desktop_tools");
                            setFeedbackOpen(true);
                          }}
                        />
                      ) : (
                        <HeaderMenuItem
                          key={item.href}
                          {...item}
                          onClick={() =>
                            trackLandingToolClick(item.href, "landing_header_desktop_tools")
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
              <Link href="/select-plan" className={navButtonClass}>
                <DesktopNavIcon icon={Calculator} />
                {headerMessages.pricing}
              </Link>
              <Link href="/academy" className={navButtonClass}>
                <DesktopNavIcon icon={BookOpen} />
                {headerMessages.academy}
              </Link>
              <Link href="/blog" className={navButtonClass}>
                <DesktopNavIcon icon={Sparkles} />
                {headerMessages.blog}
              </Link>
              <Link href="/#faq" className={navButtonClass}>
                <DesktopNavIcon icon={MessageSquare} />
                {headerMessages.faq}
              </Link>
            </nav>

            <div className="flex items-center gap-2 sm:gap-2.5">
              {isSignedIn && (
                <Link
                  href="/dashboard"
                  className="landing-press-button landing-press-button--compact inline-flex items-center justify-center text-[14px] font-medium"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {headerMessages.dashboard}
                </Link>
              )}
              {showAuthButtons ? (
                <>
                  {!isSignedIn ? (
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                      <button className="landing-press-button landing-press-button--compact inline-flex items-center justify-center px-3 text-[12px] font-medium sm:px-5 sm:text-[14px]">
                        <UserCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">{headerMessages.signUpDesktop}</span>
                        <span className="sm:hidden">{headerMessages.signUpMobile}</span>
                      </button>
                    </SignInButton>
                  ) : (
                    <UserButton />
                  )}
                </>
              ) : null}

              <button
                type="button"
                className="rounded-[16px] p-2 text-black transition-colors hover:bg-white xl:hidden"
                onClick={(event) => {
                  event.stopPropagation();
                  setMobileMenuOpen((current) => !current);
                }}
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
          className={`absolute inset-x-0 top-full z-[65] mt-2 transition-all duration-300 xl:hidden ${
            mobileMenuOpen
              ? "visible translate-y-0 opacity-100"
              : "invisible -translate-y-2 opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex w-full flex-col gap-4 overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-white px-4 py-5 shadow-[0_20px_52px_rgba(0,0,0,0.08)] sm:px-5 sm:py-6">
            <div className="max-h-[calc(100vh-8.25rem)] overflow-y-auto overscroll-contain touch-pan-y pr-1 [-webkit-overflow-scrolling:touch]">
              <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-[#666666]">
                {headerMessages.features}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {mobileFeatureItems.map((item) => (
                  <HeaderMobileTileItem
                    key={item.href}
                    {...item}
                    isNew={false}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-5 text-[12px] font-medium uppercase tracking-[0.2em] text-[#666666]">
                {headerMessages.tools}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {mobileToolItems.map((item) =>
                  item.href === "#feedback" ? (
                    <HeaderMobileTileItem
                      key={item.href}
                      {...item}
                      as="button"
                      onClick={() => {
                        trackLandingToolClick(item.href, "landing_header_mobile_tools");
                        setMobileMenuOpen(false);
                        setFeedbackOpen(true);
                      }}
                    />
                  ) : (
                    <HeaderMobileTileItem
                      key={item.href}
                      {...item}
                      onClick={() => {
                        trackLandingToolClick(item.href, "landing_header_mobile_tools");
                        setMobileMenuOpen(false);
                      }}
                    />
                  )
                )}
              </div>

              <div className="mt-5 text-[12px] font-medium uppercase tracking-[0.2em] text-[#666666]">
                {locale === "zh" ? "更多" : "More"}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {mobileMoreItems.map((item) => (
                  <HeaderMobileTileItem
                    key={item.href}
                    {...item}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FeedbackDialog
        variant="suggest_tool"
        source="landing_header_tools"
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
      />
    </header>
  );
}
