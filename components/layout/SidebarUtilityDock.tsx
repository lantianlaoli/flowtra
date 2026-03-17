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

function UtilityAction({ icon: Icon, label, onClick, href, onNavigate }: UtilityActionProps) {
  const content = (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E7E7E4] bg-white text-[#444444] transition-all duration-150 hover:border-[#D8D8D8] hover:bg-[#FAFAFA] hover:text-[#111111]"
    >
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
    <div className="flex items-center justify-center gap-1.5 rounded-[24px] bg-transparent p-0">
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
