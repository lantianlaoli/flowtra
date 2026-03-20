import type { VideoModel } from '@/lib/constants';

export type ProjectAgentIntent = 'avatar_ads' | 'competitor_ugc_replication' | 'motion_clone';

export const PROJECT_AGENT_VIDEO_MODELS: VideoModel[] = ['kling_3'];

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
  return 'kling_3';
}

export function getEffectiveProjectAgentVideoModel(
  intent: ProjectAgentIntent | undefined,
  preferredModel: unknown
): VideoModel {
  if (intent === 'avatar_ads' || intent === 'competitor_ugc_replication') {
    return 'kling_3';
  }
  return normalizeProjectAgentVideoModel(preferredModel, 'kling_3', intent);
}

export function isProjectAgentModelDisabledForIntent(
  model: VideoModel,
  intent: ProjectAgentIntent | undefined
): boolean {
  return model !== 'kling_3';
}
