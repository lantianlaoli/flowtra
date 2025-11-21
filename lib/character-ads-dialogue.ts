export const CHARACTER_ADS_DURATION_OPTIONS = [
  8,
  16,
  24,
  32,
  40,
  48,
  56,
  64,
  72,
  80
] as const;

export type CharacterAdsDuration = typeof CHARACTER_ADS_DURATION_OPTIONS[number];

const DEFAULT_WORDS_PER_SECOND = 5.6;

// Preserve legacy explicit limits for historical durations so older projects remain consistent
const LEGACY_WORD_LIMITS: Record<number, number> = {
  8: 48,
  10: 60,
  16: 88,
  20: 112,
  24: 136,
  30: 168
};

export function getCharacterAdsDialogueWordLimit(durationSeconds: number): number {
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
