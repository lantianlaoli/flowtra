'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { Check, Globe, Moon, Sun } from 'lucide-react';
import { useI18n } from '@/providers/I18nProvider';
import { SITE_LOCALE_OPTIONS } from '@/lib/i18n/site';
import { applyDashboardTheme, DASHBOARD_THEME_STORAGE_KEY, getPreferredDashboardTheme } from '@/lib/theme';

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

export default function FloatingPreferences() {
  const { locale, setLocale, messages } = useI18n();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    SITE_LOCALE_OPTIONS.find((option) => option.value === locale) ?? SITE_LOCALE_OPTIONS[0];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const enabled = getPreferredDashboardTheme();
    setIsDarkMode(enabled);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = (trigger?: HTMLElement) => {
    const nextValue = !isDarkMode;
    const applyTheme = () => {
      setIsDarkMode(nextValue);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, String(nextValue));
        applyDashboardTheme(nextValue);
        window.dispatchEvent(
          new CustomEvent('flowtra-dashboard-theme-change', { detail: nextValue }),
        );
      }
    };

    if (typeof window !== 'undefined') {
      const transitionDocument = document as ViewTransitionCapableDocument;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion && transitionDocument.startViewTransition && trigger) {
        const rect = trigger.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );

        const transition = transitionDocument.startViewTransition(() => {
          applyTheme();
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 700,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        }).catch(() => {});
        return;
      }
    }

    applyTheme();
  };

  return (
    <div
      ref={containerRef}
      className="fixed right-4 top-4 z-[80] md:right-6 md:top-6"
    >
      <div className="rounded-[22px] border border-[#E5E5E5] bg-white/92 p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLanguageOpen((current) => !current)}
              aria-label={messages.landing.header.languageSwitcherLabel}
              aria-expanded={isLanguageOpen}
              className="inline-flex h-11 items-center gap-2 rounded-[16px] px-3 text-[14px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
            >
              <Globe className="h-4 w-4 shrink-0 text-[#666666]" />
              <span>{selectedOption.nativeName}</span>
              <ChevronDownIcon className={`h-4 w-4 text-[#666666] transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLanguageOpen ? (
              <div className="absolute right-0 top-full mt-2 min-w-[188px] rounded-[18px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
                <div className="flex flex-col gap-1">
                  {SITE_LOCALE_OPTIONS.map((option) => {
                    const active = option.value === locale;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setLocale(option.value);
                          setIsLanguageOpen(false);
                        }}
                        className={`flex items-center justify-between rounded-[14px] px-3 py-2 text-left text-[14px] transition-colors ${
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

          <button
            type="button"
            onClick={(event) => toggleDarkMode(event.currentTarget)}
            aria-label={messages.landing.header.themeToggleLabel}
            className="inline-flex h-11 items-center gap-2 rounded-[16px] px-3 text-[14px] font-medium text-black transition-colors hover:bg-[#F7F7F7]"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 shrink-0 text-[#666666]" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-[#666666]" />
            )}
            <span>{isDarkMode ? messages.common.lightMode : messages.common.darkMode}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
