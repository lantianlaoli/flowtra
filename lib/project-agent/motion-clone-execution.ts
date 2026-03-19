export type ProjectAgentMotionCloneSelection = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

export type ProjectAgentMotionCloneReferenceVideo = {
  id: string;
  description?: string | null;
  videoUrl?: string | null;
  videoCdnUrl?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
  analysisLanguage?: string | null;
};

export type ProjectAgentMotionClonePhase =
  | 'idle'
  | 'generating_preview'
  | 'preview_ready'
  | 'generating_video'
  | 'completed'
  | 'failed';

export type ProjectAgentMotionCloneStage =
  | 'reference_selection'
  | 'replacement_selection'
  | 'workspace';

export type ProjectAgentMotionCloneExecution = {
  projectId?: string | null;
  stage?: ProjectAgentMotionCloneStage;
  phase: ProjectAgentMotionClonePhase;
  status?: string | null;
  referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
  selectedAvatar?: ProjectAgentMotionCloneSelection | null;
  selectedProduct?: ProjectAgentMotionCloneSelection | null;
  photoPrompt?: string | null;
  videoPrompt?: string | null;
  previewImageUrl?: string | null;
  outputVideoUrl?: string | null;
  videoQuality?: '720p' | '1080p' | null;
  durationSeconds?: number | null;
  creditsCost?: number | null;
  error?: string | null;
  promptsInitialized?: boolean;
};

type MotionCloneProjectRow = {
  id?: string | null;
  status?: string | null;
  creator_source_video_id?: string | null;
  reference_video_url?: string | null;
  reference_video_cdn_url?: string | null;
  reference_cover_url?: string | null;
  reference_duration_seconds?: number | null;
  photo_prompt?: string | null;
  video_prompt?: string | null;
  preview_image_url?: string | null;
  output_video_url?: string | null;
  mode?: string | null;
  credits_cost?: number | null;
  error_message?: string | null;
};

export const mapMotionClonePhaseFromStatus = (
  status: unknown
): ProjectAgentMotionClonePhase => {
  switch (status) {
    case 'generating_preview':
      return 'generating_preview';
    case 'preview_ready':
      return 'preview_ready';
    case 'generating_video':
      return 'generating_video';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
};

export const inferMotionCloneStage = (options?: {
  referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
  selectedAvatar?: ProjectAgentMotionCloneSelection | null;
  explicitStage?: ProjectAgentMotionCloneStage | null;
}): ProjectAgentMotionCloneStage => {
  if (options?.explicitStage === 'workspace' && options?.selectedAvatar?.id) {
    return 'workspace';
  }
  if (options?.selectedAvatar?.id) {
    return 'workspace';
  }
  if (options?.referenceVideo?.id) {
    return 'replacement_selection';
  }
  return 'reference_selection';
};

export const buildMotionClonePromptDrafts = (options?: {
  avatarName?: string | null;
  productName?: string | null;
}) => {
  const avatarName = options?.avatarName?.trim() || '';
  const productName = options?.productName?.trim() || '';

  const imagePrompt = avatarName && productName
    ? `Replace the subject in the reference video with ${avatarName} and swap in ${productName}. Keep the same framing, lighting, background, and overall look.`
    : avatarName
      ? `Replace the subject in the reference video with ${avatarName}. Keep the same framing, lighting, background, and overall look.`
      : productName
        ? `Replace the product in the reference video with ${productName}. Keep the same framing, lighting, background, and overall look.`
        : 'Replace the subject in the reference video while keeping the same framing, lighting, background, and overall look.';

  const videoPrompt = avatarName && productName
    ? 'Keep all elements the same as the reference video. Only swap the person and product.'
    : avatarName
      ? 'Keep all elements the same as the reference video. Only swap the person.'
      : productName
        ? 'Keep all elements the same as the reference video. Only swap the product.'
        : 'Keep all elements the same as the reference video.';

  return {
    photoPrompt: imagePrompt,
    videoPrompt,
  };
};

export const toMotionCloneExecutionFromProject = (
  project: MotionCloneProjectRow,
  options?: {
    referenceVideo?: ProjectAgentMotionCloneReferenceVideo | null;
    selectedAvatar?: ProjectAgentMotionCloneSelection | null;
    selectedProduct?: ProjectAgentMotionCloneSelection | null;
  }
): ProjectAgentMotionCloneExecution => ({
  projectId: project.id || null,
  stage: inferMotionCloneStage({
    referenceVideo: options?.referenceVideo || null,
    selectedAvatar: options?.selectedAvatar || null,
  }),
  phase: mapMotionClonePhaseFromStatus(project.status),
  status: project.status || null,
  referenceVideo: options?.referenceVideo || null,
  selectedAvatar: options?.selectedAvatar || null,
  selectedProduct: options?.selectedProduct || null,
  photoPrompt: project.photo_prompt || null,
  videoPrompt: project.video_prompt || null,
  previewImageUrl: project.preview_image_url || null,
  outputVideoUrl: project.output_video_url || null,
  videoQuality: project.mode === '1080p' ? '1080p' : '720p',
  durationSeconds: typeof project.reference_duration_seconds === 'number'
    ? project.reference_duration_seconds
    : null,
  creditsCost: typeof project.credits_cost === 'number' ? project.credits_cost : null,
  error: project.error_message || null,
  promptsInitialized: Boolean(project.photo_prompt || project.video_prompt),
});
