import type { VideoModel } from '@/lib/constants';

export type ProjectAgentIntent = 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';

export const PROJECT_AGENT_VIDEO_MODELS: VideoModel[] = [
  'veo3_fast',
  'seedance_1_5_pro',
  'kling_3',
  'veo3'
];

export const PROJECT_AGENT_CLONE_VIDEO_MODELS: VideoModel[] = ['kling_3'];

export function getProjectAgentVideoModels(intent?: ProjectAgentIntent): VideoModel[] {
  if (intent === 'competitor_ugc_replication') {
    return PROJECT_AGENT_CLONE_VIDEO_MODELS;
  }
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
  fallback: VideoModel = 'veo3_fast',
  intent?: ProjectAgentIntent
): VideoModel {
  if (intent === 'competitor_ugc_replication') {
    return 'kling_3';
  }
  return isProjectAgentVideoModel(value, intent) ? value : fallback;
}

export function getEffectiveProjectAgentVideoModel(
  intent: ProjectAgentIntent | undefined,
  preferredModel: unknown
): VideoModel {
  if (intent === 'avatar_ads') {
    return 'veo3_fast';
  }
  if (intent === 'competitor_ugc_replication') {
    return 'kling_3';
  }
  return normalizeProjectAgentVideoModel(preferredModel, 'veo3_fast', intent);
}

export function isProjectAgentModelDisabledForIntent(
  model: VideoModel,
  intent: ProjectAgentIntent | undefined
): boolean {
  if (intent === 'avatar_ads') {
    return model !== 'veo3_fast';
  }
  if (intent === 'competitor_ugc_replication') {
    return model !== 'kling_3';
  }
  return false;
}
