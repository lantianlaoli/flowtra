import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, Globe, Home, Moon, Sun, User } from 'lucide-react';
import { SITE_LOCALE_OPTIONS } from '@/lib/i18n/site';
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

const languagePopoverClassName =
  'absolute bottom-full left-1/2 z-20 mb-2 min-w-[184px] -translate-x-1/2 rounded-[18px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.12)]';

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
  const { locale, setLocale, messages } = useI18n();
  const utilityMessages = messages.dashboard.utilityDock;
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    SITE_LOCALE_OPTIONS.find((option) => option.value === locale) ?? SITE_LOCALE_OPTIONS[0];

  const toggleLanguageMenu = () => {
    setIsLanguageOpen((current) => !current);
  };

  const selectLanguage = (value: (typeof SITE_LOCALE_OPTIONS)[number]['value']) => {
    setLocale(value);
    setIsLanguageOpen(false);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | globalThis.MouseEvent) => {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1.5 bg-transparent p-0">
      <UtilityAction
        icon={User}
        label={utilityMessages.account}
        href={accountHref}
        onNavigateTo={onNavigateTo}
        onNavigate={onNavigate}
      />

      <div ref={languageRef} className="relative">
        <button
          type="button"
          onPointerUp={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            toggleLanguageMenu();
          }}
          onClick={(event) => {
            if (event.detail !== 0) return;
            event.preventDefault();
            toggleLanguageMenu();
          }}
          aria-label={utilityMessages.language}
          aria-expanded={isLanguageOpen}
          title={`${utilityMessages.language}: ${selectedOption.nativeName}`}
        >
          <span className={utilityButtonClassName}>
            <Globe className="h-4.5 w-4.5 shrink-0" />
          </span>
        </button>

        {isLanguageOpen ? (
          <div className={languagePopoverClassName}>
            <div className="flex flex-col gap-1">
              {SITE_LOCALE_OPTIONS.map((option) => {
                const isActive = option.value === locale;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onPointerUp={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      selectLanguage(option.value);
                    }}
                    onClick={(event) => {
                      if (event.detail !== 0) return;
                      event.preventDefault();
                      selectLanguage(option.value);
                    }}
                    className={`flex items-center justify-between rounded-[14px] px-3 py-2 text-left text-[14px] transition-colors ${
                      isActive ? 'bg-black text-white' : 'text-black hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{option.label}</span>
                      <span className={`text-[12px] ${isActive ? 'text-white/72' : 'text-[#666666]'}`}>
                        {option.nativeName}
                      </span>
                    </div>
                    {isActive ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

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
