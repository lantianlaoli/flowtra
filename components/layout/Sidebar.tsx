'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  PanelLeftClose,
  PanelLeftOpen,
  Plus
} from 'lucide-react';
import {
  Sidebar as ShadcnSidebar,
  SidebarProvider
} from '@/components/ui/sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import CreditsDisplay from '@/components/ui/CreditsDisplay';
import SidebarUtilityDock from '@/components/layout/SidebarUtilityDock';
import { cn } from '@/lib/utils';

interface CreditsData {
  credits_remaining: number;
  subscription_credits?: number;
  purchased_credits?: number;
}

interface SidebarProps {
  credits?: number; // Backward compatibility: total credits
  creditsData?: CreditsData; // New: full credits breakdown
  userEmail?: string;
  userImageUrl?: string;
  onTriggerOnboarding?: () => void;
}

const navigation = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home
  },
  {
    name: 'Agent',
    href: '/dashboard/agent',
    icon: MessageCircle
  },
  {
    name: 'Video Clone',
    href: '/dashboard/competitor-ugc-replication',
    icon: Sparkles
  },
  {
    name: 'Avatar Ads',
    href: '/dashboard/avatar-ads',
    icon: Video
  },
  {
    name: 'Motion Swap',
    href: '/dashboard/motion-swap',
    icon: Shuffle
  },
  {
    name: 'My Ads',
    href: '/dashboard/my-ads',
    icon: Play
  },
  {
    name: 'Assets',
    href: '/dashboard/assets',
    icon: Boxes
  },
  {
    name: 'Account',
    href: '/dashboard/account',
    icon: User
  }
];

export default function Sidebar({ credits, creditsData, onTriggerOnboarding }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('flowtra-dashboard-dark');
    return stored === null ? true : stored === 'true';
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('flowtra-dashboard-sidebar-collapsed');
    if (stored !== null) return stored === 'true';
    return (
      document.documentElement.classList.contains('flowtra-sidebar-collapsed') ||
      document.body.classList.contains('flowtra-sidebar-collapsed')
    );
  });
  const [isSidebarReady, setIsSidebarReady] = useState(false);

  // Use creditsData if available, otherwise fall back to legacy credits prop
  const displayCredits = creditsData?.credits_remaining ?? credits;
  const subscriptionCredits = creditsData?.subscription_credits ?? 0;
  const purchasedCredits = creditsData?.purchased_credits ?? 0;

  useLayoutEffect(() => {
    setIsSidebarReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('flowtra-sidebar-collapsed', isCollapsed);
    document.body.classList.toggle('flowtra-sidebar-collapsed', isCollapsed);
    window.localStorage.setItem('flowtra-dashboard-sidebar-collapsed', String(isCollapsed));
    window.dispatchEvent(new CustomEvent('flowtra-dashboard-sidebar-collapse', { detail: isCollapsed }));
  }, [isCollapsed]);

  const toggleDarkMode = () => {
    const nextValue = !isDarkMode;
    setIsDarkMode(nextValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('flowtra-dashboard-dark', String(nextValue));
      document.documentElement.classList.toggle('dashboard-theme', nextValue);
      document.body.classList.toggle('dashboard-theme', nextValue);
      window.dispatchEvent(new CustomEvent('flowtra-dashboard-theme-change', { detail: nextValue }));
    }
  };

  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const renderNavigation = (collapsed: boolean, layoutId: string, onNavigate?: () => void) => (
    <LayoutGroup id={layoutId}>
      <nav className="space-y-1.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const isAgentEntry = item.href === '/dashboard/agent';

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'relative flex items-center overflow-hidden rounded-2xl border px-3 py-3 text-sm font-medium transition-all duration-150',
                collapsed ? 'justify-center px-0' : 'gap-3',
                isActive
                  ? 'border-[#111111] bg-[#111111] text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)]'
                  : 'border-transparent bg-transparent text-[#5F5F5F] hover:border-[#E5E5E5] hover:bg-[#F7F7F7] hover:text-[#111111]'
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={layoutId === 'sidebar-nav' ? 'sidebar-active-pill' : 'sidebar-active-pill-mobile'}
                  className="absolute inset-0 -z-10 rounded-2xl bg-[#111111]"
                  transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 1 }}
                />
              ) : null}

              <item.icon className={cn('h-4.5 w-4.5 shrink-0', collapsed ? '' : '', isActive ? 'text-white' : 'text-[#6A6A6A]')} />

              {!collapsed ? (
                <div className="inline-flex min-w-0 items-center gap-2">
                  <span className={cn('truncate', isActive ? 'text-white' : 'text-[#4F4F4F]')}>
                    {item.name}
                  </span>
                  {isAgentEntry ? (
                    <span
                      className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none',
                        isActive
                          ? 'border-white/20 bg-white/10 text-white'
                          : 'border-[#E3E3E3] bg-white text-[#8A8A8A]'
                      )}
                    >
                      Beta
                    </span>
                  ) : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );

  const DesktopSidebarContent = () => (
    <div className="sidebar-shell flex h-full min-h-0 flex-col bg-[#FCFCFC] text-[#111111]">
      <div className={cn('sidebar-topbar shrink-0 px-4 py-4', isCollapsed && 'px-3')}>
        <div className={cn('flex items-center gap-3', isCollapsed ? 'justify-center' : 'justify-between')}>
          {!isCollapsed && displayCredits !== undefined ? (
            <div className="min-w-0 flex-1">
              <CreditsDisplay
                credits={displayCredits}
                subscriptionCredits={subscriptionCredits}
                purchasedCredits={purchasedCredits}
                onAddCredits={() => { window.location.href = '/#pricing'; }}
              />
            </div>
          ) : null}

          {isCollapsed && displayCredits !== undefined ? (
            <button
              type="button"
              onClick={() => { window.location.href = '/#pricing'; }}
              className="sidebar-collapse-button inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#111111] bg-[#111111] text-white transition-colors hover:bg-black"
              aria-label="Add credits"
              title={`${displayCredits.toLocaleString()} credits`}
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="sidebar-collapse-button inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#DFDFDF] bg-white text-[#222222] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-[#CFCFCF] hover:bg-[#F7F7F7]"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-3', isCollapsed && 'px-2')}>
        {renderNavigation(isCollapsed, 'sidebar-nav', () => setMobileOpen(false))}
      </div>

      <div className={cn('sidebar-bottomdock shrink-0 px-3 py-3', isCollapsed && 'px-2')}>
        <SidebarUtilityDock
          isCollapsed={isCollapsed}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onTriggerOnboarding={onTriggerOnboarding}
        />
      </div>
    </div>
  );

  const MobileSidebarContent = () => (
    <div className="sidebar-shell flex h-full min-h-0 flex-col bg-[#FCFCFC] text-[#111111]">
      <div className="sidebar-topbar shrink-0 px-4 py-4">
        <div className="flex items-center gap-3">
          {displayCredits !== undefined ? (
            <div className="min-w-0 flex-1">
              <CreditsDisplay
                credits={displayCredits}
                subscriptionCredits={subscriptionCredits}
                purchasedCredits={purchasedCredits}
                onAddCredits={() => {
                  setMobileOpen(false);
                  window.location.href = '/#pricing';
                }}
              />
            </div>
          ) : null}
          <div className="sidebar-collapse-button inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#DFDFDF] bg-white text-[#222222] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <PanelLeftOpen className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {renderNavigation(false, 'sidebar-nav-mobile', () => setMobileOpen(false))}
      </div>

      <div className="sidebar-bottomdock shrink-0 px-3 py-3">
        <SidebarUtilityDock
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => {
            toggleDarkMode();
            setMobileOpen(false);
          }}
          onTriggerOnboarding={onTriggerOnboarding ? () => {
            onTriggerOnboarding();
            setMobileOpen(false);
          } : undefined}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn("hidden md:block fixed md:top-0 md:left-0 md:h-screen md:z-20", isSidebarReady ? "transition-[width] duration-200" : "transition-none", isCollapsed ? "md:w-[88px]" : "md:w-72")}>
        <SidebarProvider>
          <ShadcnSidebar className={cn("h-full border-r border-[#EAEAEA] bg-[#FCFCFC] text-[#111111]", isSidebarReady ? "transition-[width] duration-200" : "transition-none", isCollapsed ? "w-[88px]" : "w-72")}>
            <DesktopSidebarContent />
          </ShadcnSidebar>
        </SidebarProvider>
      </div>

      {/* Mobile Menu Button */}
      <button
        type="button"
        className="fixed md:hidden top-4 left-4 z-40 flex items-center gap-2 rounded-2xl border border-[#E0E0E0] bg-white px-4 py-2.5 text-sm font-medium text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
        <span>Menu</span>
      </button>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-r border-[#EAEAEA] bg-[#FCFCFC] p-0 text-[#111111]"
        >
          <MobileSidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
