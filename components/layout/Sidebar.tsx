'use client';

import { useState } from 'react';
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
  Menu
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

interface SidebarProps {
  credits?: number;
  userEmail?: string;
  userImageUrl?: string;
  onTriggerOnboarding?: () => void;
}

const navigation = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home,
    onboardingId: 'sidebar-home'
  },
  {
    name: 'UGC Clone',
    href: '/dashboard/competitor-ugc-replication',
    icon: Sparkles,
    onboardingId: 'sidebar-competitor-ugc-replication'
  },
  {
    name: 'Avatar Ads',
    href: '/dashboard/avatar-ads',
    icon: Video,
    onboardingId: 'sidebar-avatar-ads'
  },
  {
    name: 'My Ads',
    href: '/dashboard/videos',
    icon: Play,
    onboardingId: 'sidebar-my-ads'
  },
  {
    name: 'Assets',
    href: '/dashboard/assets',
    icon: Boxes,
    onboardingId: 'sidebar-assets'
  },
  {
    name: 'Account',
    href: '/dashboard/account',
    icon: User,
    onboardingId: 'sidebar-account'
  }
];

export default function Sidebar({ credits = 0, userEmail, userImageUrl, onTriggerOnboarding }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop sidebar content (uses shadcn Sidebar components with SidebarProvider)
  const DesktopSidebarContent = () => (
    <>
      <SidebarHeader className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <Image
            src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/logo.png"
            alt="Flowtra Logo"
            width={32}
            height={32}
            className="w-8 h-8 transition-transform group-hover:scale-105 duration-200"
          />
          <span className="text-lg font-semibold text-black group-hover:text-[#666666] transition-colors duration-200">
            Flowtra
          </span>
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
        {credits !== undefined && (
          <div className="mb-6">
            <CreditsDisplay
              credits={credits}
              onAddCredits={() => window.location.href = '/#pricing'}
            />
          </div>
        )}

        <Separator className="mb-6 bg-[#E5E5E5]" />

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
                            ? "text-white bg-black hover:bg-black/90"
                            : "text-[#666666] hover:text-black hover:bg-[#F7F7F7]"
                        )}
                      >
                        <Link
                          href={item.href}
                          data-onboarding-id={item.onboardingId}
                          onClick={() => setMobileOpen(false)}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="sidebar-active-indicator"
                              className="absolute inset-0 rounded-lg bg-black -z-10"
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
                              isActive ? "text-white" : "text-[#666666]"
                            )}
                          />
                          <span className={cn("relative z-10", isActive && "text-white")}>{item.name}</span>
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

      <SidebarFooter className="p-6 border-t border-[#E5E5E5]">
        <div className="space-y-2">
          {/* Product Tour */}
          {onTriggerOnboarding && (
            <button
              onClick={onTriggerOnboarding}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-[#666666] hover:text-black hover:bg-[#F7F7F7] rounded-lg transition-colors duration-200"
            >
              <HelpCircle className="w-5 h-5" />
              <span>Product Tour</span>
            </button>
          )}

          {/* Feedback Widget */}
          <FeedbackWidget />

          {/* Back to Landing */}
          <Link
            href="/"
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-[#666666] hover:text-black hover:bg-[#F7F7F7] rounded-lg transition-colors duration-200"
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
            src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/logo.png"
            alt="Flowtra Logo"
            width={32}
            height={32}
            className="w-8 h-8 transition-transform group-hover:scale-105 duration-200"
          />
          <span className="text-lg font-semibold text-black group-hover:text-[#666666] transition-colors duration-200">
            Flowtra
          </span>
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
        {credits !== undefined && (
          <div className="mb-6">
            <CreditsDisplay
              credits={credits}
              onAddCredits={() => window.location.href = '/#pricing'}
            />
          </div>
        )}

        <Separator className="mb-6 bg-[#E5E5E5]" />

        {/* Navigation */}
        <nav className="space-y-1">
          <LayoutGroup id="sidebar-nav-mobile">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  data-onboarding-id={item.onboardingId}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center h-10 px-3 text-sm font-medium rounded-lg transition-colors duration-200 overflow-hidden",
                    isActive
                      ? "text-white bg-black"
                      : "text-[#666666] hover:text-black hover:bg-[#F7F7F7]"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-indicator-mobile"
                      className="absolute inset-0 rounded-lg bg-black -z-10"
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
                      isActive ? "text-white" : "text-[#666666]"
                    )}
                  />
                  <span className={cn("relative z-10", isActive && "text-white")}>{item.name}</span>
                </Link>
              );
            })}
          </LayoutGroup>
        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[#E5E5E5]">
        <div className="space-y-2">
          {/* Product Tour */}
          {onTriggerOnboarding && (
            <button
              onClick={() => {
                onTriggerOnboarding();
                setMobileOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-[#666666] hover:text-black hover:bg-[#F7F7F7] rounded-lg transition-colors duration-200"
            >
              <HelpCircle className="w-5 h-5" />
              <span>Product Tour</span>
            </button>
          )}

          {/* Feedback Widget */}
          <FeedbackWidget />

          {/* Back to Landing */}
          <Link
            href="/"
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-[#666666] hover:text-black hover:bg-[#F7F7F7] rounded-lg transition-colors duration-200"
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
          <ShadcnSidebar className="w-72 h-full border-r border-[#E5E5E5] bg-white">
            <DesktopSidebarContent />
          </ShadcnSidebar>
        </SidebarProvider>
      </div>

      {/* Mobile Menu Button */}
      <button
        type="button"
        className="fixed md:hidden top-4 left-4 z-40 bg-black text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 transition-transform duration-200"
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
          className="w-72 p-0 bg-white border-r border-[#E5E5E5]"
        >
          <MobileSidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
