'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  History, 
  CreditCard, 
  Settings,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  credits?: number;
}

const navigation = [
  {
    name: 'Workspace',
    href: '/dashboard',
    icon: Home
  },
  {
    name: 'History',
    href: '/dashboard/history',
    icon: History
  },
  {
    name: 'Credits',
    href: '/dashboard/credits',
    icon: CreditCard
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings
  }
];

export default function Sidebar({ credits }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      <div className="p-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-gray-900 rounded-md flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm"></div>
          </div>
          <span className="text-xl font-semibold text-gray-900">Flowtra</span>
        </Link>

        {/* Credits Display */}
        {credits !== undefined && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Credits</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{credits}</div>
            <Link 
              href="/pricing"
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Buy more credits
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}