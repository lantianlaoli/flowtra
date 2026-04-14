import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { BookOpen, Check, ChevronUp, Globe, Home, Moon, Sun, User } from 'lucide-react';
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
  'sidebar-utility-button flex h-10 w-full min-w-[172px] items-center justify-start gap-2.5 rounded-[20px] border border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] px-3 text-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] transition-all duration-150 hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]';

function UtilityAction({ icon: Icon, label, onClick, href, onNavigateTo, onNavigate }: UtilityActionProps) {
  const content = (
    <span className={utilityButtonClassName}>
      <Icon className="sidebar-utility-icon h-4.5 w-4.5 shrink-0" />
      <span className="sidebar-utility-label truncate text-[13px] font-medium">{label}</span>
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
        onClick={handleNavigate}
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
      onClick={handleClick}
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
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const languageContainerRef = useRef<HTMLDivElement | null>(null);
  const utilityMessages = messages.dashboard.utilityDock;
  const selectedOption =
    SITE_LOCALE_OPTIONS.find((option) => option.value === locale) ?? SITE_LOCALE_OPTIONS[0];

  const handleLanguageToggle = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setIsLanguageOpen((current) => !current);
  };

  const handleLanguageSelect = (value: (typeof SITE_LOCALE_OPTIONS)[number]['value']) => (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setLocale(value);
    setIsLanguageOpen(false);
  };

  useEffect(() => {
    const handlePointerDownOutside = (event: globalThis.MouseEvent) => {
      if (languageContainerRef.current && !languageContainerRef.current.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => document.removeEventListener('mousedown', handlePointerDownOutside);
  }, []);

  return (
    <div className="flex min-w-[172px] flex-col items-stretch gap-1.5 bg-transparent p-0">
      <UtilityAction
        icon={User}
        label={utilityMessages.account}
        href={accountHref}
        onNavigateTo={onNavigateTo}
        onNavigate={onNavigate}
      />

      <div ref={languageContainerRef} className="relative w-full">
        <button
          type="button"
          onPointerUp={handleLanguageToggle}
          aria-label={utilityMessages.language}
          aria-expanded={isLanguageOpen}
          aria-haspopup="menu"
          title={`${utilityMessages.language}: ${selectedOption.nativeName}`}
          className={utilityButtonClassName}
        >
          <Globe className="sidebar-utility-icon h-4.5 w-4.5 shrink-0" />
          <span className="sidebar-utility-label truncate text-[13px] font-medium">{utilityMessages.language}</span>
        </button>

        {isLanguageOpen ? (
          <div className="absolute bottom-full left-0 z-[70] mb-2 min-w-[188px] rounded-[18px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
              <span className="text-[12px] font-medium text-[#666666]">{utilityMessages.language}</span>
              <ChevronUp className="h-3.5 w-3.5 text-[#9A9A9A]" />
            </div>
            <div className="flex flex-col gap-1">
              {SITE_LOCALE_OPTIONS.map((option) => {
                const active = option.value === locale;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onPointerUp={handleLanguageSelect(option.value)}
                    className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[14px] transition-colors ${
                      active ? 'bg-black text-white' : 'text-black hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{option.label}</span>
                      <span className={`text-[12px] ${active ? 'text-white/72' : 'text-[#666666]'}`}>
                        {option.nativeName}
                      </span>
                    </div>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <UtilityAction
        icon={BookOpen}
        label={utilityMessages.academy}
        href="/academy"
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
