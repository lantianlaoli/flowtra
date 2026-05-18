import type { VideoModel } from '@/lib/constants';
import {
  getProjectAgentVideoCloneAllowedModels,
  type ProjectAgentVideoCloneMode,
} from '@/lib/project-agent/video-clone-mode';

export type ProjectAgentIntent = 'avatar_ads' | 'video_clone' | 'motion_clone';
export type ProjectAgentVideoModel = 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27';

export const PROJECT_AGENT_VIDEO_MODELS: ProjectAgentVideoModel[] = ['seedance_2', 'kling_3', 'seedance_2_fast'];

export function getProjectAgentVideoModels(
  intent?: ProjectAgentIntent,
  cloneMode: ProjectAgentVideoCloneMode = 'clone'
): ProjectAgentVideoModel[] {
  if (intent === 'video_clone') {
    return getProjectAgentVideoCloneAllowedModels(cloneMode);
  }
  if (intent === 'avatar_ads') {
    return ['seedance_2_fast', 'seedance_2', 'kling_3', 'wan_27'];
  }
  if (intent === 'motion_clone') {
    return ['kling_3'];
  }
  return ['kling_3'];
}

export function isProjectAgentVideoModel(
  value: unknown,
  intent?: ProjectAgentIntent,
  cloneMode?: ProjectAgentVideoCloneMode
): value is ProjectAgentVideoModel {
  return typeof value === 'string' && getProjectAgentVideoModels(intent, cloneMode).includes(value as ProjectAgentVideoModel);
}

export function normalizeProjectAgentVideoModel(
  value: unknown,
  fallback: ProjectAgentVideoModel = 'kling_3',
  intent?: ProjectAgentIntent,
  cloneMode?: ProjectAgentVideoCloneMode
): ProjectAgentVideoModel {
  if (isProjectAgentVideoModel(value, intent, cloneMode)) {
    return value;
  }
  return isProjectAgentVideoModel(fallback, intent, cloneMode)
    ? fallback
    : getProjectAgentVideoModels(intent, cloneMode)[0] || 'kling_3';
}

export function getEffectiveProjectAgentVideoModel(
  intent: ProjectAgentIntent | undefined,
  preferredModel: unknown,
  cloneMode?: ProjectAgentVideoCloneMode
): ProjectAgentVideoModel {
  if (intent === 'avatar_ads') {
    return normalizeProjectAgentVideoModel(preferredModel, 'seedance_2_fast', intent);
  }
  if (intent === 'video_clone') {
    return normalizeProjectAgentVideoModel(preferredModel, 'seedance_2', intent, cloneMode);
  }
  return normalizeProjectAgentVideoModel(preferredModel, 'kling_3', intent);
}

export function isProjectAgentModelDisabledForIntent(
  model: VideoModel,
  intent: ProjectAgentIntent | undefined,
  cloneMode?: ProjectAgentVideoCloneMode
): boolean {
  if (!isProjectAgentVideoModel(model, intent, cloneMode)) {
    return true;
  }
  if (intent === 'video_clone') {
    return !getProjectAgentVideoModels(intent, cloneMode).includes(model);
  }
  return !getProjectAgentVideoModels(intent).includes(model);
}
