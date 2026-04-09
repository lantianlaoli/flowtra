import {
  formatMissingFeatureInputsLabel,
  type ProjectAgentAssetNodeType,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';

export type ProjectAgentCanvasNotice = {
  id: number;
  message: string;
  severity: 'warning';
  source: 'canvas';
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
}): string => {
  if (input.blockedReason) {
    return input.blockedReason;
  }

  if (input.missingInputs.length > 0) {
    return `Connect ${formatMissingFeatureInputsLabel(input.featureType, input.missingInputs).replace(', ', ' and ')} to start`;
  }

  if (input.featureType === 'video_clone') {
    return 'Ready to start. Optionally connect a Text node to add product behavior details.';
  }

  return 'Ready to start';
};
