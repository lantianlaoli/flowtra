export type CharacterAdsDuration = 8 | 10 | 16 | 20 | 24 | 30;

const DIALOGUE_WORD_LIMITS: Record<CharacterAdsDuration, number> = {
  8: 48,
  10: 60,
  16: 88,
  20: 112,
  24: 136,
  30: 168
};

const FALLBACK_DURATION: CharacterAdsDuration = 16;

const DURATION_KEYS: CharacterAdsDuration[] = [8, 10, 16, 20, 24, 30];

export function getCharacterAdsDialogueWordLimit(durationSeconds: number): number {
  if (DIALOGUE_WORD_LIMITS[durationSeconds as CharacterAdsDuration]) {
    return DIALOGUE_WORD_LIMITS[durationSeconds as CharacterAdsDuration];
  }

  const closest = DURATION_KEYS.reduce((closestDuration, current) => {
    const closestDiff = Math.abs(closestDuration - durationSeconds);
    const currentDiff = Math.abs(current - durationSeconds);
    return currentDiff < closestDiff ? current : closestDuration;
  }, FALLBACK_DURATION);

  return DIALOGUE_WORD_LIMITS[closest];
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
