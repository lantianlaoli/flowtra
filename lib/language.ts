import { LANGUAGE_NAMES, LANGUAGE_NATIVE_NAMES, type LanguageCode } from './constants';

export interface LanguageDisplayInfo {
  code: string;
  label: string;
  native?: string | null;
  isKnown: boolean;
}

export const isLanguageCode = (value: string): value is LanguageCode => {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, value);
};

export function getLanguageDisplayInfo(code?: string | null): LanguageDisplayInfo | null {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  if (isLanguageCode(normalized)) {
    return {
      code: normalized,
      label: LANGUAGE_NAMES[normalized],
      native: LANGUAGE_NATIVE_NAMES[normalized],
      isKnown: true
    };
  }

  return {
    code: normalized,
    label: code.toUpperCase(),
    native: null,
    isKnown: false
  };
}
