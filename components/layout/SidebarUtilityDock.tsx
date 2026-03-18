import Link from 'next/link';
import type { MouseEvent } from 'react';
import { Home, Moon, Sun, User } from 'lucide-react';

interface SidebarUtilityDockProps {
  isDarkMode: boolean;
  onToggleDarkMode: (trigger: HTMLElement) => void;
  onNavigate?: () => void;
  accountHref: string;
}

interface UtilityActionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  onNavigate?: () => void;
}

const utilityButtonClassName =
  'sidebar-utility-button flex h-10 w-10 items-center justify-center rounded-[20px] border border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] text-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] transition-all duration-150 hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]';

function UtilityAction({ icon: Icon, label, onClick, href, onNavigate }: UtilityActionProps) {
  const content = (
    <span className={utilityButtonClassName}>
      <Icon className="h-4.5 w-4.5 shrink-0" />
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
  isDarkMode,
  onToggleDarkMode,
  onNavigate,
  accountHref,
}: SidebarUtilityDockProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 bg-transparent p-0">
      <UtilityAction
        icon={User}
        label="Account"
        href={accountHref}
        onNavigate={onNavigate}
      />

      <UtilityAction
        icon={isDarkMode ? Sun : Moon}
        label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
        onClick={(event) => onToggleDarkMode(event.currentTarget)}
      />

      <UtilityAction
        icon={Home}
        label="Back to Landing"
        href="/"
        onNavigate={onNavigate}
      />
    </div>
  );
}
