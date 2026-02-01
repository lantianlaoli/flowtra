'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Home,
  Sparkles,
  Video,
  Play,
  Boxes,
  User,
  HelpCircle,
  Menu,
  Shuffle,
  Moon,
  Sun
} from 'lucide-react';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@/components/ui/sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import CreditsDisplay from '@/components/ui/CreditsDisplay';
import UserProfile from '@/components/ui/UserProfile';
import FeedbackWidget from '@/components/FeedbackWidget';
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

export default function Sidebar({ credits = 0, creditsData, userEmail, userImageUrl, onTriggerOnboarding }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Use creditsData if available, otherwise fall back to legacy credits prop
  const displayCredits = creditsData?.credits_remaining ?? credits;
  const subscriptionCredits = creditsData?.subscription_credits ?? 0;
  const purchasedCredits = creditsData?.purchased_credits ?? 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('flowtra-dashboard-dark');
    const enabled = stored === null ? true : stored === 'true';
    setIsDarkMode(enabled);
  }, []);

  const toggleDarkMode = () => {
    const nextValue = !isDarkMode;
    setIsDarkMode(nextValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('flowtra-dashboard-dark', String(nextValue));
      document.documentElement.classList.toggle('dashboard-theme', nextValue);
      window.dispatchEvent(new CustomEvent('flowtra-dashboard-theme-change', { detail: nextValue }));
    }
  };

  // Desktop sidebar content (uses shadcn Sidebar components with SidebarProvider)
  const DesktopSidebarContent = () => (
    <>
      <SidebarHeader className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <Image
            src="/logo.svg"
            alt="Flowtra Logo"
            width={95}
            height={95}
            className="w-[95px] h-[95px] transition-transform group-hover:scale-105 duration-200 logo-theme"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-6">
        {/* User Profile */}
        {userEmail && (
          <div className="mb-4">
            <UserProfile userEmail={userEmail} userImageUrl={userImageUrl} />
          </div>
        )}

        {/* Credits Display */}
        {(credits !== undefined || creditsData) && (
          <div className="mb-6">
            <CreditsDisplay
              credits={displayCredits}
              subscriptionCredits={subscriptionCredits}
              purchasedCredits={purchasedCredits}
              onAddCredits={() => window.location.href = '/#pricing'}
            />
          </div>
        )}

        <Separator className="mb-6 bg-border" />

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <LayoutGroup id="sidebar-nav">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          "relative h-10 px-3 text-sm font-medium rounded-lg transition-colors duration-200 overflow-hidden",
                          isActive
                            ? (isDarkMode
                              ? "text-sidebar-foreground bg-sidebar-accent border border-sidebar-border shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
                              : "text-accent-foreground bg-accent hover:bg-accent/90 border border-accent/30")
                            : (isDarkMode
                              ? "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted")
                        )}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="sidebar-active-indicator"
                              className={cn(
                                "absolute inset-0 rounded-lg -z-10",
                                isDarkMode ? "bg-sidebar-accent" : "bg-accent"
                              )}
                              transition={{
                                type: 'spring',
                                stiffness: 500,
                                damping: 35,
                                mass: 1
                              }}
                            />
                          )}
                          <item.icon
                            className={cn(
                              "relative z-10 w-4 h-4 mr-3 transition-transform duration-200",
                              isActive
                                ? (isDarkMode ? "text-sidebar-foreground" : "text-accent-foreground")
                                : (isDarkMode ? "text-sidebar-foreground/70" : "text-muted-foreground")
                            )}
                          />
                          <span
                            className={cn(
                              "relative z-10",
                              isActive ? (isDarkMode ? "text-sidebar-foreground" : "text-accent-foreground") : ""
                            )}
                          >
                            {item.name}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </LayoutGroup>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-6 border-t border-sidebar-border">
        <div className="space-y-2">
          {/* Product Tour */}
          {onTriggerOnboarding && (
            <button
              onClick={onTriggerOnboarding}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
            >
              <HelpCircle className="w-5 h-5" />
              <span>Product Tour</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
            aria-label="Toggle dark mode"
            type="button"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Feedback Widget */}
          <FeedbackWidget />

          {/* Back to Landing */}
          <Link
            href="/"
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
            onClick={() => setMobileOpen(false)}
          >
            <Home className="w-5 h-5" />
            <span>Back to Landing</span>
          </Link>
        </div>
      </SidebarFooter>
    </>
  );

  // Mobile sidebar content (plain HTML, no SidebarProvider dependency)
  const MobileSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
          <Image
            src="/logo.svg"
            alt="Flowtra Logo"
            width={95}
            height={95}
            className="w-[95px] h-[95px] transition-transform group-hover:scale-105 duration-200 logo-theme"
          />
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6">
        {/* User Profile */}
        {userEmail && (
          <div className="mb-4">
            <UserProfile userEmail={userEmail} userImageUrl={userImageUrl} />
          </div>
        )}

        {/* Credits Display */}
        {(credits !== undefined || creditsData) && (
          <div className="mb-6">
            <CreditsDisplay
              credits={displayCredits}
              subscriptionCredits={subscriptionCredits}
              purchasedCredits={purchasedCredits}
              onAddCredits={() => window.location.href = '/#pricing'}
            />
          </div>
        )}

        <Separator className="mb-6 bg-border" />

        {/* Navigation */}
        <nav className="space-y-1">
          <LayoutGroup id="sidebar-nav-mobile">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center h-10 px-3 text-sm font-medium rounded-lg transition-colors duration-200 overflow-hidden",
                    isActive
                      ? (isDarkMode
                        ? "text-sidebar-foreground bg-sidebar-accent border border-sidebar-border shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
                        : "text-accent-foreground bg-accent border border-accent/30")
                      : (isDarkMode
                        ? "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted")
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-indicator-mobile"
                      className={cn(
                        "absolute inset-0 rounded-lg -z-10",
                        isDarkMode ? "bg-sidebar-accent" : "bg-accent"
                      )}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 35,
                        mass: 1
                      }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      "relative z-10 w-4 h-4 mr-3 transition-transform duration-200",
                      isActive
                        ? (isDarkMode ? "text-sidebar-foreground" : "text-accent-foreground")
                        : (isDarkMode ? "text-sidebar-foreground/70" : "text-muted-foreground")
                    )}
                  />
                  <span
                    className={cn(
                      "relative z-10",
                      isActive ? (isDarkMode ? "text-sidebar-foreground" : "text-accent-foreground") : ""
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </LayoutGroup>
        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-sidebar-border">
        <div className="space-y-2">
          {/* Product Tour */}
          {onTriggerOnboarding && (
            <button
              onClick={() => {
                onTriggerOnboarding();
                setMobileOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
            >
              <HelpCircle className="w-5 h-5" />
              <span>Product Tour</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => {
              toggleDarkMode();
              setMobileOpen(false);
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
            aria-label="Toggle dark mode"
            type="button"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Feedback Widget */}
          <FeedbackWidget />

          {/* Back to Landing */}
          <Link
            href="/"
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
            onClick={() => setMobileOpen(false)}
          >
            <Home className="w-5 h-5" />
            <span>Back to Landing</span>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed md:top-0 md:left-0 md:h-screen md:w-72 md:z-20">
        <SidebarProvider>
          <ShadcnSidebar className="w-72 h-full border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <DesktopSidebarContent />
          </ShadcnSidebar>
        </SidebarProvider>
      </div>

      {/* Mobile Menu Button */}
      <button
        type="button"
        className="fixed md:hidden top-4 left-4 z-40 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 transition-transform duration-200"
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
          className="w-72 p-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
        >
          <MobileSidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
