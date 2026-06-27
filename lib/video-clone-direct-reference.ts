import {
  getModelSupportedDurations,
  snapDurationToModel,
  type VideoDuration,
  type VideoModel,
} from '@/lib/constants';
import {
  isSeedanceCloneModel,
  normalizeCloneDurationSeconds,
} from '@/lib/video-clone-billing';

export type DashboardStoryboardReferenceRequestOptions = {
  requestSource: 'project_agent_clone';
  executionMode: 'clone_storyboard_reference';
  referenceSourceVideoUrl?: string;
  videoDuration: VideoDuration;
};

export type DashboardDirectReferenceRequestOptions = DashboardStoryboardReferenceRequestOptions;

export function getPlayableReferenceVideoUrl(input: {
  videoUrl?: string | null;
  videoCdnUrl?: string | null;
}): string | null {
  const videoCdnUrl = input.videoCdnUrl?.trim();
  if (videoCdnUrl) return videoCdnUrl;

  const videoUrl = input.videoUrl?.trim();
  return videoUrl || null;
}

export function getDashboardDirectReferenceRequestOptions(input: {
  model: VideoModel;
  durationSeconds?: number | null;
  videoUrl?: string | null;
  videoCdnUrl?: string | null;
}): DashboardStoryboardReferenceRequestOptions | null {
  const durationSeconds = normalizeCloneDurationSeconds(input.durationSeconds);
  const referenceSourceVideoUrl = getPlayableReferenceVideoUrl(input);

  if (!isSeedanceCloneModel(input.model) || durationSeconds === null) {
    return null;
  }

  return {
    requestSource: 'project_agent_clone',
    executionMode: 'clone_storyboard_reference',
    ...(referenceSourceVideoUrl ? { referenceSourceVideoUrl } : {}),
    videoDuration: String(durationSeconds) as VideoDuration,
  };
}

export function isDashboardDirectReferenceCandidate(input: {
  model: VideoModel;
  durationSeconds?: number | null;
}): boolean {
  const durationSeconds = normalizeCloneDurationSeconds(input.durationSeconds);
  return isSeedanceCloneModel(input.model) && durationSeconds !== null;
}

export function getDashboardVideoCloneDuration(input: {
  model: VideoModel;
  referenceDurationSeconds?: number | null;
  defaultDuration?: VideoDuration;
  directReferenceOptions?: DashboardDirectReferenceRequestOptions | null;
}): VideoDuration {
  if (input.directReferenceOptions?.videoDuration) {
    return input.directReferenceOptions.videoDuration;
  }

  const targetDurationSeconds = Number(input.referenceDurationSeconds || 0);
  if (!targetDurationSeconds) {
    return input.defaultDuration || getModelSupportedDurations(input.model)[0];
  }

  return snapDurationToModel(input.model, Math.min(targetDurationSeconds, 64));
}
