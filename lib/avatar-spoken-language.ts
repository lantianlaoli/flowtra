import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { isLanguageCode } from '@/lib/language';

const SCRIPT_RANGES: Array<{ code: LanguageCode; pattern: RegExp }> = [
  { code: 'zh', pattern: /[\u3400-\u9FFF]/g },
  { code: 'ja', pattern: /[\u3040-\u30FF]/g },
  { code: 'ko', pattern: /[\uAC00-\uD7AF]/g },
];

const normalizeConfiguredLanguage = (value?: string | null): LanguageCode | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return isLanguageCode(normalized) ? normalized : null;
};

export const detectAvatarScriptLanguage = (
  scriptSource?: string | null,
): LanguageCode | null => {
  if (!scriptSource) return null;
  const normalized = scriptSource.trim();
  if (!normalized) return null;

  let bestMatch: { code: LanguageCode; count: number } | null = null;

  for (const entry of SCRIPT_RANGES) {
    const count = normalized.match(entry.pattern)?.length ?? 0;
    if (count === 0) continue;
    if (!bestMatch || count > bestMatch.count) {
      bestMatch = { code: entry.code, count };
    }
  }

  return bestMatch?.count ? bestMatch.code : null;
};

export const resolveAvatarSpokenLanguage = (input: {
  scriptSource?: string | null;
  configuredLanguage?: string | null;
}): LanguageCode => {
  const detected = detectAvatarScriptLanguage(input.scriptSource);
  if (detected) return detected;
  return normalizeConfiguredLanguage(input.configuredLanguage) || 'en';
};

export const inferAvatarVoiceGender = (...values: Array<unknown>): 'male' | 'female' | null => {
  const combined = values
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  if (!combined) return null;
  if (/\b(female|woman|girl)\b/.test(combined)) return 'female';
  if (/\b(male|man|boy)\b/.test(combined)) return 'male';
  return null;
};

export const buildAvatarVoiceType = (
  language: LanguageCode,
  gender?: 'male' | 'female' | null,
) => {
  const languageName = getLanguagePromptName(language);
  if (gender === 'female') return `Warm female voice speaking natural ${languageName}.`;
  if (gender === 'male') return `Warm male voice speaking natural ${languageName}.`;
  return `Warm natural voice speaking natural ${languageName}.`;
};
