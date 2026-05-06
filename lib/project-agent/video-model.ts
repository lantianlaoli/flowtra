import type { VideoModel } from '@/lib/constants';

export type ProjectAgentIntent = 'avatar_ads' | 'video_clone' | 'motion_clone';

export const PROJECT_AGENT_VIDEO_MODELS: VideoModel[] = ['seedance_2', 'kling_3', 'seedance_2_fast'];

export function getProjectAgentVideoModels(intent?: ProjectAgentIntent): VideoModel[] {
  return PROJECT_AGENT_VIDEO_MODELS;
}

export function isProjectAgentVideoModel(
  value: unknown,
  intent?: ProjectAgentIntent
): value is VideoModel {
  return typeof value === 'string' && getProjectAgentVideoModels(intent).includes(value as VideoModel);
}

export function normalizeProjectAgentVideoModel(
  value: unknown,
  fallback: VideoModel = 'kling_3',
  intent?: ProjectAgentIntent
): VideoModel {
  if (isProjectAgentVideoModel(value, intent)) {
    return value;
  }
  return isProjectAgentVideoModel(fallback, intent) ? fallback : 'kling_3';
}

export function getEffectiveProjectAgentVideoModel(
  intent: ProjectAgentIntent | undefined,
  preferredModel: unknown
): VideoModel {
  if (intent === 'avatar_ads') {
    return 'kling_3';
  }
  if (intent === 'video_clone') {
    return normalizeProjectAgentVideoModel(preferredModel, 'seedance_2', intent);
  }
  return normalizeProjectAgentVideoModel(preferredModel, 'kling_3', intent);
}

export function isProjectAgentModelDisabledForIntent(
  model: VideoModel,
  intent: ProjectAgentIntent | undefined
): boolean {
  if (intent === 'video_clone') {
    return model !== 'seedance_2' && model !== 'kling_3' && model !== 'seedance_2_fast';
  }
  return model !== 'kling_3';
}
