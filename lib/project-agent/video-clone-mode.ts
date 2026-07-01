import type { ProjectAgentConnectedFeatureInputs } from '@/lib/project-agent/node-execution';
import type { ProjectAgentVideoModel } from '@/lib/project-agent/video-model';
import { SEEDANCE_VIDEO_MODELS } from '@/lib/constants';

export type ProjectAgentVideoCloneMode = 'clone' | 'edit_video';

export const getProjectAgentVideoCloneMode = (
  inputs: ProjectAgentConnectedFeatureInputs
): ProjectAgentVideoCloneMode => {
  const hasCloneTarget = Boolean(inputs.avatar || inputs.product || inputs.pet);
  if (inputs.video && inputs.text && !hasCloneTarget) {
    return 'edit_video';
  }

  return 'clone';
};

export const getProjectAgentVideoCloneDurationSeconds = (
  inputs: ProjectAgentConnectedFeatureInputs
) => {
  const mediaDurationSeconds = inputs.video?.mediaDurationSeconds;
  if (typeof mediaDurationSeconds === 'number' && Number.isFinite(mediaDurationSeconds) && mediaDurationSeconds > 0) {
    return mediaDurationSeconds;
  }

  const durationSeconds = inputs.video?.durationSeconds;
  return typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : null;
};

export const getProjectAgentVideoCloneAllowedModels = (
  mode: ProjectAgentVideoCloneMode
): ProjectAgentVideoModel[] => [...SEEDANCE_VIDEO_MODELS];

export const normalizeProjectAgentVideoCloneModel = (
  preferredModel: unknown,
  mode: ProjectAgentVideoCloneMode
): ProjectAgentVideoModel => {
  const allowedModels = getProjectAgentVideoCloneAllowedModels(mode);
  return typeof preferredModel === 'string' && allowedModels.includes(preferredModel as ProjectAgentVideoModel)
    ? preferredModel as ProjectAgentVideoModel
    : 'seedance_2_mini';
};
