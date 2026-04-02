'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  buildSiteLocaleCookie,
  SITE_LOCALE_STORAGE_KEY,
  getDocumentLang,
  normalizeSiteLocale,
  type SiteLocale,
} from '@/lib/i18n/site';
import { siteMessages } from '@/lib/i18n/site-messages';

type I18nContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
  messages: (typeof siteMessages)[SiteLocale];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = 'en',
}: {
  children: ReactNode;
  initialLocale?: SiteLocale;
}) {
  const [locale, setLocaleState] = useState<SiteLocale>(initialLocale);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
      document.cookie = buildSiteLocaleCookie(locale);
    }
    document.documentElement.lang = getDocumentLang(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: SiteLocale) => {
    setLocaleState(normalizeSiteLocale(nextLocale));
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    messages: siteMessages[locale],
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}
