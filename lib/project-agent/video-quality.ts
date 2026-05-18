import type { PersistedVideoQuality, VideoModel } from '@/lib/constants';
import type { ProjectAgentIntent } from '@/lib/project-agent/video-model';

export type ProjectAgentVideoQuality = '480p' | '720p' | '1080p';

export function getProjectAgentAllowedVideoQualities(
  intent: ProjectAgentIntent,
  model: VideoModel,
): ProjectAgentVideoQuality[] {
  if (model === 'seedance_2_fast') {
    return ['480p', '720p'];
  }

  if (model === 'seedance_2') {
    return ['480p', '720p', '1080p'];
  }

  if (model === 'kling_3') {
    return ['720p', '1080p'];
  }

  if (model === 'wan_27') {
    return ['720p', '1080p'];
  }

  if (intent === 'motion_clone') {
    return ['720p', '1080p'];
  }

  return ['720p'];
}

export function getEffectiveProjectAgentVideoQuality(
  intent: ProjectAgentIntent,
  model: VideoModel,
  preferredQuality?: PersistedVideoQuality | null,
): ProjectAgentVideoQuality {
  const allowed = getProjectAgentAllowedVideoQualities(intent, model);
  const normalizedPreferred = preferredQuality === '480p' || preferredQuality === '1080p'
    ? preferredQuality
    : '720p';
  return allowed.includes(normalizedPreferred) ? normalizedPreferred : '720p';
}

export function canChangeProjectAgentVideoQuality(
  intent: ProjectAgentIntent,
  model: VideoModel,
) {
  return getProjectAgentAllowedVideoQualities(intent, model).length > 1;
}
