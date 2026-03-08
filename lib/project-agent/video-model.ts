import type { VideoModel } from '@/lib/constants';

export type ProjectAgentIntent = 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';

export const PROJECT_AGENT_VIDEO_MODELS: VideoModel[] = [
  'veo3_fast',
  'seedance_1_5_pro',
  'kling_3',
  'veo3'
];

export function isProjectAgentVideoModel(value: unknown): value is VideoModel {
  return typeof value === 'string' && PROJECT_AGENT_VIDEO_MODELS.includes(value as VideoModel);
}

export function normalizeProjectAgentVideoModel(
  value: unknown,
  fallback: VideoModel = 'veo3_fast'
): VideoModel {
  return isProjectAgentVideoModel(value) ? value : fallback;
}

export function getEffectiveProjectAgentVideoModel(
  intent: ProjectAgentIntent | undefined,
  preferredModel: unknown
): VideoModel {
  if (intent === 'avatar_ads') {
    return 'veo3_fast';
  }
  return normalizeProjectAgentVideoModel(preferredModel);
}

export function isProjectAgentModelDisabledForIntent(
  model: VideoModel,
  intent: ProjectAgentIntent | undefined
): boolean {
  return intent === 'avatar_ads' && model !== 'veo3_fast';
}
