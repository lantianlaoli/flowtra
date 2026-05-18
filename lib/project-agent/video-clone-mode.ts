import type { ProjectAgentConnectedFeatureInputs } from '@/lib/project-agent/node-execution';
import type { ProjectAgentVideoModel } from '@/lib/project-agent/video-model';

export type ProjectAgentVideoCloneMode = 'clone' | 'edit_video';

export const getProjectAgentVideoCloneMode = (
  inputs: ProjectAgentConnectedFeatureInputs
): ProjectAgentVideoCloneMode => {
  if (inputs.video && inputs.text && !inputs.avatar && !inputs.product) {
    return 'edit_video';
  }

  return 'clone';
};

export const getProjectAgentVideoCloneDurationSeconds = (
  inputs: ProjectAgentConnectedFeatureInputs
) => {
  const durationSeconds = inputs.video?.durationSeconds;
  return typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
    ? durationSeconds
    : null;
};

export const getProjectAgentVideoCloneAllowedModels = (
  mode: ProjectAgentVideoCloneMode
): ProjectAgentVideoModel[] => (
  mode === 'edit_video'
    ? ['seedance_2', 'seedance_2_fast']
    : ['seedance_2', 'seedance_2_fast', 'kling_3']
);

export const normalizeProjectAgentVideoCloneModel = (
  preferredModel: unknown,
  mode: ProjectAgentVideoCloneMode
): ProjectAgentVideoModel => {
  const allowedModels = getProjectAgentVideoCloneAllowedModels(mode);
  return typeof preferredModel === 'string' && allowedModels.includes(preferredModel as ProjectAgentVideoModel)
    ? preferredModel as ProjectAgentVideoModel
    : 'seedance_2';
};
