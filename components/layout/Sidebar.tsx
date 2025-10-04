'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Plus,
  Home,
  User,
  Coins,
  Sparkles,
  Play,
  Layers,
  Image as ImageIcon,
  Video,
  Package
} from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import FeedbackWidget from '@/components/FeedbackWidget';

interface SidebarProps {
  credits?: number;
  userEmail?: string;
  userImageUrl?: string;
}

const navigation = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home
  },
  {
    name: 'Standard Ads',
    href: '/dashboard/standard-ads',
    icon: Sparkles
  },
  {
    name: 'Multi-Variant Ads',
    href: '/dashboard/multi-variant-ads',
    icon: Layers
  },
  {
    name: 'Character Ads',
    href: '/dashboard/character-ads',
    icon: Video
  },
  {
    name: 'My Ads',
    href: '/dashboard/videos',
    icon: Play
  },
  {
    name: 'My Products',
    href: '/dashboard/products',
    icon: Package
  },
  {
    name: 'Account',
    href: '/dashboard/account',
    icon: User
  }
];

export default function Sidebar({ credits = 0, userEmail, userImageUrl }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="w-72 bg-white border-r border-gray-300 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 flex-1">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 mb-8 group">
          <Image 
            src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/logo.png" 
            alt="Flowtra Logo" 
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Flowtra</span>
        </Link>

        {/* User Info */}
        {userEmail && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {userImageUrl ? (
                  <Image 
                    src={userImageUrl} 
                    alt="User avatar" 
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Credits Display */}
        {credits !== undefined && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Coins className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-900">Credits</span>
              </div>
              <Link 
                href="/pricing"
                className="w-8 h-8 bg-gray-900 hover:bg-gray-800 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                title="Buy more credits"
              >
                <Plus className="w-4 h-4 text-white" />
              </Link>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{credits.toLocaleString()}</div>
          </div>
        )}

        {/* Navigation */}
        <LayoutGroup>
          <nav className="space-y-1 relative">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 overflow-hidden',
                    isActive ? 'text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebarActive"
                      className="absolute inset-0 rounded-lg bg-gray-900 shadow shadow-gray-900/25"
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn(
                    'relative z-10 w-4 h-4 transition-colors duration-150',
                    isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                  )} />
                  <span className="relative z-10 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</span>
                  {('badge' in item) && (
                    <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {(item as { badge: string }).badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>
      
      {/* Feedback and Navigation */}
      <div className="p-6 border-t border-gray-200 space-y-2">
        <FeedbackWidget />
        <Link 
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors font-medium"
        >
          <Home className="w-5 h-5" />
          <span>Back to Landing</span>
        </Link>
      </div>
    </div>
  );
}
