import {
  SEEDANCE_MIN_TASK_DURATION_SECONDS,
  SEEDANCE_MAX_TASK_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  KLING_MAX_TASK_DURATION_SECONDS,
  type VideoModel,
} from '@/lib/constants';
import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';

const CJK_PROMO_SHORTFORM_PROFILE: Partial<Record<string, {
  charactersPerSecond: number;
  strongPauseSeconds: number;
  softPauseSeconds: number;
}>> = {
  zh: {
    charactersPerSecond: 6.4,
    strongPauseSeconds: 0.18,
    softPauseSeconds: 0.08,
  },
  zh_yue: {
    charactersPerSecond: 6.8,
    strongPauseSeconds: 0.18,
    softPauseSeconds: 0.08,
  },
};

const STRONG_PAUSE_REGEX = /[。！？!?]/g;
const SOFT_PAUSE_REGEX = /[，,；;：:]/g;
const CJK_CONTENT_REGEX = /[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g;

export function estimateAvatarAdsDialogueSeconds(
  dialogue: string,
  model: VideoModel,
  language?: string | null,
): number {
  const trimmedDialogue = dialogue.trim();
  if (!trimmedDialogue) {
    return 0;
  }

  const languageCode = resolveAvatarSpokenLanguage({
    scriptSource: trimmedDialogue,
    configuredLanguage: language || 'en',
  });

  if (model === 'wan_27') {
    const profile = CJK_PROMO_SHORTFORM_PROFILE[languageCode];
    if (profile) {
      const contentChars = trimmedDialogue.match(CJK_CONTENT_REGEX)?.length ?? 0;
      if (contentChars > 0 && contentChars <= 80) {
        const strongPauses = trimmedDialogue.match(STRONG_PAUSE_REGEX)?.length ?? 0;
        const softPauses = trimmedDialogue.match(SOFT_PAUSE_REGEX)?.length ?? 0;
        const estimated =
          contentChars / profile.charactersPerSecond +
          strongPauses * profile.strongPauseSeconds +
          softPauses * profile.softPauseSeconds;
        return Math.round(estimated * 10) / 10;
      }
    }
  }

  return estimateDialogueDuration(trimmedDialogue, languageCode);
}

export function estimateAvatarAdsSingleSceneDurationSeconds(
  dialogue: string,
  model: VideoModel,
  language?: string | null,
): number {
  const trimmedDialogue = dialogue.trim();
  if (!trimmedDialogue) {
    return 0;
  }

  const languageCode = resolveAvatarSpokenLanguage({
    scriptSource: trimmedDialogue,
    configuredLanguage: language || 'en',
  });
  const estimated = estimateAvatarAdsDialogueSeconds(trimmedDialogue, model, languageCode);

  if (!Number.isFinite(estimated) || estimated <= 0) {
    return 0;
  }

  if (model === 'kling_3') {
    if (estimated <= 7.5) {
      return Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.min(7, Math.ceil(estimated)));
    }
    return Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.min(KLING_MAX_TASK_DURATION_SECONDS, Math.ceil(estimated + 0.4)));
  }

  if (model === 'wan_27') {
    if (estimated <= 7.5) {
      return Math.max(2, Math.min(7, Math.ceil(estimated)));
    }
    return Math.max(2, Math.min(15, Math.ceil(estimated + 0.1)));
  }

  if (estimated <= 7.5) {
    return Math.max(SEEDANCE_MIN_TASK_DURATION_SECONDS, Math.min(7, Math.ceil(estimated)));
  }

  return Math.max(8, Math.min(SEEDANCE_MAX_TASK_DURATION_SECONDS, Math.ceil(estimated + 0.4)));
}
