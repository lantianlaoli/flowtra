import type { VideoModel } from '@/lib/constants';

type CloneExecutionLike = {
  phase?: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
  mergedVideoUrl?: string | null;
};

type CloneExecutionSegmentLike = {
  videoUrl?: string | null;
};

export function resolveProjectAgentCloneMergedVideoUrl(input: {
  videoUrl?: string | null;
  segmentStatusMergedVideoUrl?: string | null;
  segments?: CloneExecutionSegmentLike[] | null;
  model?: VideoModel | null;
}) {
  if (input.segmentStatusMergedVideoUrl?.trim()) {
    return input.segmentStatusMergedVideoUrl.trim();
  }

  const segments = Array.isArray(input.segments) ? input.segments : [];
  const hasMultipleSegments = segments.length > 1;
  if (hasMultipleSegments && input.videoUrl?.trim()) {
    return input.videoUrl.trim();
  }

  return null;
}

export function shouldShowProjectAgentCloneMergedReview(
  execution: CloneExecutionLike | null | undefined
) {
  if (!execution) return false;
  return execution.phase === 'merging' || Boolean(execution.mergedVideoUrl);
}
