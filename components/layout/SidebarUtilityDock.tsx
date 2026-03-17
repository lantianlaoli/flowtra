'use client';

import Link from 'next/link';
import { HelpCircle, Home, MessageSquare, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarUtilityDockProps {
  isCollapsed?: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onTriggerOnboarding?: () => void;
  onNavigate?: () => void;
}

interface UtilityActionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed?: boolean;
  onClick?: () => void;
  href?: string;
  onNavigate?: () => void;
}

function UtilityAction({ icon: Icon, label, isCollapsed, onClick, href, onNavigate }: UtilityActionProps) {
  const content = (
    <span
      className={cn(
        'flex items-center rounded-2xl border border-[#E6E6E6] bg-white px-3 py-2.5 text-sm font-medium text-[#444444] transition-all duration-150',
        'hover:border-[#D8D8D8] hover:bg-[#FAFAFA] hover:text-[#111111]',
        isCollapsed ? 'justify-center px-0' : 'gap-3'
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {!isCollapsed ? <span className="truncate">{label}</span> : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} onClick={onNavigate} aria-label={label} title={label}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}>
      {content}
    </button>
  );
}

export default function SidebarUtilityDock({
  isCollapsed = false,
  isDarkMode,
  onToggleDarkMode,
  onTriggerOnboarding,
  onNavigate,
}: SidebarUtilityDockProps) {
  return (
    <div className="rounded-[24px] border border-[#E9E9E9] bg-[#F7F7F7] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
      <div className={cn('grid gap-2', isCollapsed ? 'grid-cols-1' : 'grid-cols-1')}>
        {onTriggerOnboarding ? (
          <UtilityAction
            icon={HelpCircle}
            label="Product Tour"
            isCollapsed={isCollapsed}
            onClick={onTriggerOnboarding}
          />
        ) : null}

        <UtilityAction
          icon={isDarkMode ? Sun : Moon}
          label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          isCollapsed={isCollapsed}
          onClick={onToggleDarkMode}
        />

        <UtilityAction
          icon={MessageSquare}
          label="Support"
          isCollapsed={isCollapsed}
          href="/dashboard/support"
          onNavigate={onNavigate}
        />

        <UtilityAction
          icon={Home}
          label="Back to Landing"
          isCollapsed={isCollapsed}
          href="/"
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
