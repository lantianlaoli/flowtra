import Link from 'next/link';
import type { MouseEvent } from 'react';
import { Home, Moon, Sun, User } from 'lucide-react';
import { useI18n } from '@/providers/I18nProvider';

interface SidebarUtilityDockProps {
  isDarkMode: boolean;
  onToggleDarkMode: (trigger: HTMLElement) => void;
  onNavigateTo: (href: string, onNavigate?: () => void) => void;
  onNavigate?: () => void;
  accountHref: string;
}

interface UtilityActionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: (trigger: HTMLElement) => void;
  href?: string;
  onNavigateTo?: (href: string, onNavigate?: () => void) => void;
  onNavigate?: () => void;
}

const utilityButtonClassName =
  'sidebar-utility-button flex h-10 w-10 items-center justify-center rounded-[20px] border border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] text-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] transition-all duration-150 hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]';

function UtilityAction({ icon: Icon, label, onClick, href, onNavigateTo, onNavigate }: UtilityActionProps) {
  const content = (
    <span className={utilityButtonClassName}>
      <Icon className="h-4.5 w-4.5 shrink-0" />
    </span>
  );

  if (href) {
    const handleNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!href) return;
      event.preventDefault();
      onNavigateTo?.(href, onNavigate);
    };

    return (
      <Link
        href={href}
        onPointerUp={(event) => {
          if (event.button !== 0) return;
          handleNavigate(event);
        }}
        onClick={(event) => {
          if (event.detail !== 0) return;
          handleNavigate(event);
        }}
        aria-label={label}
        title={label}
      >
        {content}
      </Link>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onClick?.(event.currentTarget);
  };

  return (
    <button
      type="button"
      onPointerUp={(event) => {
        if (event.button !== 0) return;
        handleClick(event);
      }}
      onClick={(event) => {
        if (event.detail !== 0) return;
        handleClick(event);
      }}
      aria-label={label}
      title={label}
    >
      {content}
    </button>
  );
}

export default function SidebarUtilityDock({
  isDarkMode,
  onToggleDarkMode,
  onNavigateTo,
  onNavigate,
  accountHref,
}: SidebarUtilityDockProps) {
  const utilityMessages = useI18n().messages.dashboard.utilityDock;

  return (
    <div className="flex items-center justify-center gap-1.5 bg-transparent p-0">
      <UtilityAction
        icon={User}
        label={utilityMessages.account}
        href={accountHref}
        onNavigateTo={onNavigateTo}
        onNavigate={onNavigate}
      />

      <UtilityAction
        icon={isDarkMode ? Sun : Moon}
        label={isDarkMode ? utilityMessages.lightMode : utilityMessages.darkMode}
        onClick={onToggleDarkMode}
      />

      <UtilityAction
        icon={Home}
        label={utilityMessages.backToLanding}
        href="/"
        onNavigateTo={onNavigateTo}
        onNavigate={onNavigate}
      />
    </div>
  );
}
