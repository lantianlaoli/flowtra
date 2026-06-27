import {
  getGenerationCost,
  getSegmentVideoGenerationCost,
  normalizeCloneVideoQualityForModel,
  type PersistedVideoQuality,
  type VideoModel,
} from '@/lib/constants';
import { getEffectiveSegmentDurationSeconds, type SegmentShotTimingLike } from '@/lib/video-clone-segment-billing';

export const SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS = 15;
export const SEEDANCE_DIRECT_REFERENCE_MIN_SECONDS = 2;

export type ProjectAgentCloneExecutionMode =
  | 'clone_storyboard_reference'
  | 'clone_direct_reference'
  | 'clone_segmented_auto'
  | 'clone_manual'
  | 'edit_video';

export function isSeedanceCloneModel(model?: VideoModel | null): model is 'seedance_2' | 'seedance_2_fast' | 'seedance_2_mini' {
  return model === 'seedance_2' || model === 'seedance_2_fast' || model === 'seedance_2_mini';
}

export function normalizeCloneDurationSeconds(value?: string | number | null): number | null {
  const duration = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  const nearestSecond = Math.round(duration);
  if (Math.abs(duration - nearestSecond) <= 0.25) {
    return nearestSecond;
  }
  return Math.ceil(duration);
}

export function getProjectAgentCloneExecutionMode(input: {
  model: VideoModel;
  durationSeconds?: string | number | null;
  hasReferenceVideoUrl?: boolean;
}): ProjectAgentCloneExecutionMode {
  if (isSeedanceCloneModel(input.model)) {
    return 'clone_storyboard_reference';
  }

  return 'clone_manual';
}

export function getProjectAgentCloneGenerationCost(input: {
  model: VideoModel;
  durationSeconds?: string | number | null;
  videoQuality?: PersistedVideoQuality | null;
  executionMode?: ProjectAgentCloneExecutionMode | string | null;
  hasReferenceVideoUrl?: boolean;
}): number {
  const durationSeconds = normalizeCloneDurationSeconds(input.durationSeconds);
  if (durationSeconds === null) {
    return 0;
  }

  const executionMode = input.executionMode || getProjectAgentCloneExecutionMode({
    model: input.model,
    durationSeconds,
    hasReferenceVideoUrl: input.hasReferenceVideoUrl,
  });

  // Storyboard-mode Seedance calls only send image references
  // (`reference_image_urls`), so they use the no-video-input tier.
  // Direct-reference and edit-video modes send video input.
  const hasVideoInput = executionMode === 'clone_direct_reference'
    || executionMode === 'edit_video';

  return getGenerationCost(
    input.model,
    String(durationSeconds),
    input.videoQuality || undefined,
    { hasVideoInput }
  );
}

export function getCloneSegmentPromptGenerationCost(input: {
  model: VideoModel;
  shots?: Array<SegmentShotTimingLike> | null;
  fallbackDurationSeconds?: number | null;
  videoQuality?: PersistedVideoQuality | null;
  hasVideoInput?: boolean;
}): number {
  const segmentDurationSeconds = getEffectiveSegmentDurationSeconds(
    input.shots,
    input.fallbackDurationSeconds || 0
  );
  return getSegmentVideoGenerationCost(
    input.model,
    segmentDurationSeconds,
    normalizeCloneVideoQualityForModel(input.model, input.videoQuality),
    { hasVideoInput: input.hasVideoInput }
  );
}
