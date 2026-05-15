export type SiteLocale = 'en' | 'zh';

export const SITE_LOCALE_STORAGE_KEY = 'flowtra-site-locale';
export const SITE_LOCALE_COOKIE_KEY = 'flowtra-site-locale';
const ZH_DEFAULT_COUNTRY_CODES = new Set(['CN', 'SG']);

export const SITE_LOCALE_OPTIONS: Array<{
  value: SiteLocale;
  label: string;
  nativeName: string;
  flag: string;
}> = [
  { value: 'en', label: 'English', nativeName: 'English', flag: '🇺🇸' },
  { value: 'zh', label: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

export function normalizeSiteLocale(value: unknown): SiteLocale {
  return value === 'zh' ? 'zh' : 'en';
}

export function getDocumentLang(locale: SiteLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

export function formatLocaleNumber(locale: SiteLocale, value: number): string {
  return value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}

export function buildSiteLocaleCookie(locale: SiteLocale): string {
  return `${SITE_LOCALE_COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function inferSiteLocaleFromCountry(countryCode: string | null | undefined): SiteLocale {
  return countryCode && ZH_DEFAULT_COUNTRY_CODES.has(countryCode.toUpperCase()) ? 'zh' : 'en';
}

export function resolveInitialSiteLocale(params: {
  cookieLocale?: unknown;
  countryCode?: string | null;
}): SiteLocale {
  const cookieLocale = params.cookieLocale === 'zh' || params.cookieLocale === 'en'
    ? params.cookieLocale
    : null;

  if (cookieLocale) {
    return cookieLocale;
  }

  return inferSiteLocaleFromCountry(params.countryCode);
}
