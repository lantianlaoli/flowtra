/**
 * Language utility functions for competitor ad analysis
 *
 * Provides helpers for displaying language information with flags and native names
 */

import { LanguageCode, LANGUAGE_NAMES, LANGUAGE_NATIVE_NAMES } from '@/lib/constants';

/**
 * Map language codes to flag emojis
 *
 * Uses country flags as approximations for languages.
 * Note: Some languages span multiple countries, so we use the most representative flag.
 */
const LANGUAGE_FLAG_MAP: Record<LanguageCode, string> = {
  'en': '🇺🇸', // English - United States
  'es': '🇪🇸', // Spanish - Spain
  'fr': '🇫🇷', // French - France
  'de': '🇩🇪', // German - Germany
  'it': '🇮🇹', // Italian - Italy
  'pt': '🇵🇹', // Portuguese - Portugal
  'nl': '🇳🇱', // Dutch - Netherlands
  'sv': '🇸🇪', // Swedish - Sweden
  'no': '🇳🇴', // Norwegian - Norway
  'da': '🇩🇰', // Danish - Denmark
  'fi': '🇫🇮', // Finnish - Finland
  'pl': '🇵🇱', // Polish - Poland
  'ru': '🇷🇺', // Russian - Russia
  'el': '🇬🇷', // Greek - Greece
  'tr': '🇹🇷', // Turkish - Turkey
  'cs': '🇨🇿', // Czech - Czech Republic
  'ro': '🇷🇴', // Romanian - Romania
  'zh': '🇨🇳', // Chinese - China
  'ur': '🇵🇰', // Urdu - Pakistan
  'pa': '🇮🇳', // Punjabi - India
};

/**
 * Get flag emoji for a language code
 *
 * @param languageCode - The language code (e.g., 'en', 'zh', 'es')
 * @returns Flag emoji string (e.g., '🇺🇸') or globe emoji if not found
 *
 * @example
 * getFlagEmoji('en') // Returns '🇺🇸'
 * getFlagEmoji('zh') // Returns '🇨🇳'
 * getFlagEmoji('invalid') // Returns '🌐'
 */
export function getFlagEmoji(languageCode: string | null | undefined): string {
  if (!languageCode) {
    return '🌐'; // Globe emoji for unknown/no language
  }

  return LANGUAGE_FLAG_MAP[languageCode as LanguageCode] || '🌐';
}

/**
 * Get display name for a language code
 *
 * @param languageCode - The language code (e.g., 'en', 'zh', 'es')
 * @param preferNative - If true, returns native name (e.g., 'Español' instead of 'Spanish')
 * @returns Language display name
 *
 * @example
 * getLanguageDisplayName('en') // Returns 'English'
 * getLanguageDisplayName('zh') // Returns 'Chinese'
 * getLanguageDisplayName('es', true) // Returns 'Español'
 */
export function getLanguageDisplayName(
  languageCode: string | null | undefined,
  preferNative: boolean = false
): string {
  if (!languageCode) {
    return 'Unknown';
  }

  const code = languageCode as LanguageCode;

  if (preferNative) {
    return LANGUAGE_NATIVE_NAMES[code] || languageCode.toUpperCase();
  }

  return LANGUAGE_NAMES[code] || languageCode.toUpperCase();
}

/**
 * Format language for display with flag and name
 *
 * @param languageCode - The language code (e.g., 'en', 'zh', 'es')
 * @param options - Formatting options
 * @returns Formatted string like "🇺🇸 English" or just "🇺🇸" if no name
 *
 * @example
 * formatLanguage('en') // Returns '🇺🇸 English'
 * formatLanguage('zh', { preferNative: true }) // Returns '🇨🇳 中文'
 * formatLanguage('es', { flagOnly: true }) // Returns '🇪🇸'
 */
export function formatLanguage(
  languageCode: string | null | undefined,
  options: {
    preferNative?: boolean;
    flagOnly?: boolean;
  } = {}
): string {
  const flag = getFlagEmoji(languageCode);

  if (options.flagOnly) {
    return flag;
  }

  const name = getLanguageDisplayName(languageCode, options.preferNative);

  return `${flag} ${name}`;
}

/**
 * Check if a language code is valid
 *
 * @param languageCode - The language code to validate
 * @returns true if the code is a valid LanguageCode
 *
 * @example
 * isValidLanguageCode('en') // Returns true
 * isValidLanguageCode('invalid') // Returns false
 */
export function isValidLanguageCode(languageCode: string | null | undefined): boolean {
  if (!languageCode) {
    return false;
  }

  return languageCode in LANGUAGE_NAMES;
}

/**
 * Get all supported language codes
 *
 * @returns Array of all supported language codes
 */
export function getSupportedLanguageCodes(): LanguageCode[] {
  return Object.keys(LANGUAGE_NAMES) as LanguageCode[];
}

/**
 * Get language options for select dropdowns
 *
 * @param preferNative - If true, uses native names (e.g., 'Español' instead of 'Spanish')
 * @returns Array of options with value, label, and flag
 *
 * @example
 * const options = getLanguageOptions()
 * // Returns: [{ value: 'en', label: 'English', flag: '🇺🇸' }, ...]
 */
export function getLanguageOptions(preferNative: boolean = false): Array<{
  value: LanguageCode;
  label: string;
  flag: string;
}> {
  return getSupportedLanguageCodes().map(code => ({
    value: code,
    label: getLanguageDisplayName(code, preferNative),
    flag: getFlagEmoji(code),
  }));
}
