export const AVATAR_ADS_DURATION_OPTIONS = Array.from(
  { length: 57 },
  (_, index) => index + 4
) as number[];

export type AvatarAdsDuration = number;

const DEFAULT_WORDS_PER_SECOND = 2.1; // ~126 wpm (Safe speaking pace for short clips)

// Explicit limits for frequently used durations
const LEGACY_WORD_LIMITS: Record<number, number> = {
  8: 17,
  16: 34,
  24: 51,
  32: 68,
  40: 85,
  48: 102,
  56: 119,
  64: 136,
  72: 153,
  80: 170
};

export function getAvatarAdsDialogueWordLimit(durationSeconds: number): number {
  if (LEGACY_WORD_LIMITS[durationSeconds]) {
    return LEGACY_WORD_LIMITS[durationSeconds];
  }

  return Math.round(durationSeconds * DEFAULT_WORDS_PER_SECOND);
}

export function countDialogueWords(content: string): number {
  if (!content || !content.trim()) {
    return 0;
  }

  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function clampDialogueToWordLimit(content: string, limit: number): string {
  if (!content) {
    return '';
  }

  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const words = normalized.split(' ');
  if (words.length <= limit) {
    return normalized;
  }

  return words.slice(0, limit).join(' ');
}
