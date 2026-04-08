'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Home,
  Sparkles,
  Video,
  Play,
  Boxes,
  User,
  Menu,
  Shuffle,
  MessageCircle,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import CreditsDisplay from '@/components/ui/CreditsDisplay';
import SidebarUtilityDock from '@/components/layout/SidebarUtilityDock';
import { applyDashboardTheme, DASHBOARD_THEME_STORAGE_KEY, getPreferredDashboardTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useI18n } from '@/providers/I18nProvider';

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

interface CreditsData {
  credits_remaining: number;
  subscription_credits?: number;
  purchased_credits?: number;
}

interface SidebarProps {
  credits?: number;
  creditsData?: CreditsData;
  userEmail?: string;
  userImageUrl?: string;
  onTriggerOnboarding?: () => void;
}

const sidebarNavButtonBase =
  'sidebar-nav-button relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-[20px] border px-2.5 py-3 text-sm font-medium transition-all duration-150';

const sidebarNavButtonInactive =
  'sidebar-nav-button--inactive border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] text-[#5F5F5F] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]';

const sidebarNavButtonActive =
  'sidebar-nav-button--active border-[#111111] bg-[#111111] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_0_rgba(22,22,22,0.98),0_14px_24px_rgba(0,0,0,0.12)] hover:translate-y-[2px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_0_rgba(22,22,22,0.98),0_10px_18px_rgba(0,0,0,0.1)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_0_rgba(22,22,22,0.98),0_7px_14px_rgba(0,0,0,0.09)]';

export default function Sidebar({ credits, creditsData }: SidebarProps) {
  const sidebarMessages = useI18n().messages.dashboard.sidebar;
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopSidebarRef = useRef<HTMLDivElement | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getPreferredDashboardTheme();
  });

  const displayCredits = creditsData?.credits_remaining ?? credits;
  const subscriptionCredits = creditsData?.subscription_credits ?? 0;
  const purchasedCredits = creditsData?.purchased_credits ?? 0;
  const primaryNavigation = [
    { name: sidebarMessages.home, href: '/dashboard', icon: Home },
    { name: sidebarMessages.agent, href: '/dashboard/agent', icon: MessageCircle },
    { name: sidebarMessages.viralClone, href: '/dashboard/video-clone', icon: Sparkles },
    { name: sidebarMessages.avatarAds, href: '/dashboard/avatar-ads', icon: Video },
    { name: sidebarMessages.motionClone, href: '/dashboard/motion-clone', icon: Shuffle },
    { name: sidebarMessages.myAds, href: '/dashboard/my-ads', icon: Play },
    { name: sidebarMessages.assets, href: '/dashboard/assets', icon: Boxes },
  ];

  const navigateTo = (href: string, onNavigate?: () => void) => {
    onNavigate?.();
    if (pathname === href) return;
    router.push(href);
  };

  const toggleDarkMode = (trigger?: HTMLElement) => {
    const nextValue = !isDarkMode;
    const applyTheme = () => {
      setIsDarkMode(nextValue);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, String(nextValue));
        applyDashboardTheme(nextValue);
        window.dispatchEvent(new CustomEvent('flowtra-dashboard-theme-change', { detail: nextValue }));
      }
    };

    if (typeof window !== 'undefined') {
      const transitionDocument = document as ViewTransitionCapableDocument;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        }).catch(() => {});
        return;
      }

      applyTheme();
      return;
    }

    setIsDarkMode(nextValue);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.remove('flowtra-sidebar-collapsed');
    document.body.classList.remove('flowtra-sidebar-collapsed');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const element = desktopSidebarRef.current;
    if (!element) return;

    const updateSidebarWidth = () => {
      const width = Math.ceil(element.getBoundingClientRect().width);
      if (width > 0) {
        root.style.setProperty('--dashboard-sidebar-width', `${width}px`);
      }
    };

    updateSidebarWidth();

    const observer = new ResizeObserver(() => {
      updateSidebarWidth();
    });

    observer.observe(element);
    window.addEventListener('resize', updateSidebarWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSidebarWidth);
    };
  }, []);

  const renderPrimaryNavigation = (onNavigate?: () => void) => (
    <LayoutGroup id="floating-sidebar-nav">
      <nav
        className="inline-flex w-fit max-w-full flex-col gap-0.5"
        aria-label={sidebarMessages.navigation}
      >
        {primaryNavigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              onPointerUp={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                navigateTo(item.href, onNavigate);
              }}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(item.href, onNavigate);
              }}
              className={cn(
                sidebarNavButtonBase,
                isActive
                  ? sidebarNavButtonActive
                  : sidebarNavButtonInactive
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId="floating-sidebar-active-pill"
                  className="absolute inset-0 -z-10 rounded-[20px] bg-[#111111]"
                  transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 1 }}
                />
              ) : null}

              <item.icon className={cn('sidebar-nav-icon h-4.5 w-4.5 shrink-0 pointer-events-none', isActive ? 'text-white' : 'text-[#6A6A6A]')} />

              <div className="inline-flex min-w-0 items-center gap-2 pointer-events-none">
                <span className={cn('sidebar-nav-label whitespace-nowrap', isActive ? 'text-white' : 'text-[#4F4F4F]')}>
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );

  const SidebarPanels = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="sidebar-shell inline-flex h-full min-h-0 w-fit max-w-full flex-col items-start bg-transparent text-[#111111]">
      <div className="shrink-0 px-3 py-4">
        {displayCredits !== undefined ? (
          <CreditsDisplay
            credits={displayCredits}
            subscriptionCredits={subscriptionCredits}
            purchasedCredits={purchasedCredits}
            onAddCredits={() => { window.location.href = '/#pricing'; }}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="sidebar-nav-panel inline-flex w-fit max-w-full flex-col rounded-[26px] border border-[#E7E7E4] bg-white/90 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          {renderPrimaryNavigation(onNavigate)}
        </div>
      </div>

      <div className="shrink-0 px-3 py-4">
        <div className="sidebar-utility-panel inline-flex rounded-[26px] border border-[#E7E7E4] bg-white/90 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <SidebarUtilityDock
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onNavigateTo={navigateTo}
            onNavigate={onNavigate}
            accountHref="/dashboard/account"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={desktopSidebarRef}
        className="fixed left-0 top-0 z-50 hidden h-screen w-fit max-w-[calc(100vw-2rem)] md:block"
      >
        <SidebarPanels />
      </div>

      <button
        type="button"
        className="sidebar-mobile-trigger fixed left-4 top-4 z-40 flex items-center gap-2 rounded-[20px] border border-[#E0E0E0] bg-white px-4 py-2.5 text-sm font-medium text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label={sidebarMessages.openMenu}
      >
        <Menu className="h-4 w-4" />
        <span>{sidebarMessages.menu}</span>
      </button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-60 border-r-0 bg-[#F5F5F3] p-0 text-[#111111]"
        >
          <SidebarPanels onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
