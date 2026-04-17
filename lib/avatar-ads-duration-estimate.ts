import {
  SEEDANCE_MIN_TASK_DURATION_SECONDS,
  SEEDANCE_MAX_TASK_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  KLING_MAX_TASK_DURATION_SECONDS,
  type VideoModel,
} from '@/lib/constants';
import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';

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
  const estimated = estimateDialogueDuration(trimmedDialogue, languageCode);

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
    return Math.max(2, Math.min(15, Math.ceil(estimated + 0.4)));
  }

  if (estimated <= 7.5) {
    return Math.max(SEEDANCE_MIN_TASK_DURATION_SECONDS, Math.min(7, Math.ceil(estimated)));
  }

  return Math.max(8, Math.min(SEEDANCE_MAX_TASK_DURATION_SECONDS, Math.ceil(estimated + 0.4)));
}
