/**
 * Centralized SEO configuration. Single source of truth for the canonical
 * site URL used in metadata, sitemaps, JSON-LD, and email fallback links.
 *
 * If the production domain ever changes again, update SITE_URL here and
 * nothing else.
 */
export const SITE_URL = 'https://flowtra.ai';

export const siteUrl = (path: string = ''): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
};