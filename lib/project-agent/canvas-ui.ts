import {
  formatMissingFeatureInputsLabel,
  type ProjectAgentAssetNodeType,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import type { ProjectAgentVideoCloneMode } from '@/lib/project-agent/video-clone-mode';

export type ProjectAgentCanvasNotice = {
  id: number;
  message: string;
  severity: 'warning';
  source: 'canvas';
};

export const getPendingConnectionPathTarget = (
  cursorPoint: { x: number; y: number },
  _snappedTargetPoint?: { x: number; y: number } | null,
) => cursorPoint;

export const getFeatureStartActionTitle = (input: {
  blockedReason?: string | null;
  estimatedCredits?: number | null;
}) => (
  input.blockedReason || (
    input.estimatedCredits !== null && input.estimatedCredits !== undefined
      ? `${input.estimatedCredits} credits`
      : undefined
  )
);

export const shouldShowFeatureEstimatedCredits = (input: {
  featureType: ProjectAgentFeatureNodeType;
  estimatedCredits: number | null;
  hasConnectedVideo: boolean;
}) => {
  if (input.estimatedCredits === null) return false;
  if (input.featureType === 'video_clone' || input.featureType === 'motion_clone') {
    return input.hasConnectedVideo;
  }
  return true;
};

export const createProjectAgentCanvasNotice = (
  message: string,
  now = Date.now(),
): ProjectAgentCanvasNotice | null => {
  const trimmed = message.trim();
  if (!trimmed) return null;

  return {
    id: now,
    message: trimmed,
    severity: 'warning',
    source: 'canvas',
  };
};

export const getProjectAgentFeaturePlaceholderCopy = (input: {
  featureType: ProjectAgentFeatureNodeType;
  blockedReason: string | null;
  missingInputs: ProjectAgentAssetNodeType[];
  videoCloneMode?: ProjectAgentVideoCloneMode | null;
}): string => {
  if (input.blockedReason) {
    return input.blockedReason;
  }

  if (input.missingInputs.length > 0) {
    return `Connect ${formatMissingFeatureInputsLabel(input.featureType, input.missingInputs).replace(', ', ' and ')} to start`;
  }

  if (input.featureType === 'video_clone') {
    if (input.videoCloneMode === 'edit_video') {
      return 'Ready to edit video';
    }
    return 'Ready to start. Optionally connect Product Guidance for product behavior details.';
  }

  return 'Ready to start';
};
