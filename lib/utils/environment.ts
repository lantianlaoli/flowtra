/**
 * Environment Utility Functions
 *
 * Provides functions to determine the current environment
 * and feature availability based on environment settings.
 */

/**
 * Check if the app is running in production environment
 * @returns true if NEXT_PUBLIC_SITE_URL contains 'flowtra.store'
 */
export const isProduction = (): boolean => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  return siteUrl.includes('flowtra.store');
};

/**
 * Check if TikTok integration features should be enabled
 * @returns true in development/local environments, false in production
 */
export const isTikTokFeatureEnabled = (): boolean => {
  return !isProduction();
};

/**
 * Get environment display name for debugging
 * @returns 'Production' | 'Development'
 */
export const getEnvironmentName = (): 'Production' | 'Development' => {
  return isProduction() ? 'Production' : 'Development';
};
