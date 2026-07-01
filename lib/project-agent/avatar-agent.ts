import type { VideoModel } from '@/lib/constants';
import { ensureAvatarImagePromptMentions } from '@/lib/project-agent/avatar-script-planning';

export type ProjectAgentAvatarStage =
  | 'avatar_asset_selection'
  | 'avatar_script_collection'
  | 'avatar_workspace'
  | 'avatar_generating_cover'
  | 'avatar_reviewing_cover'
  | 'avatar_generating_video'
  | 'avatar_completed';

export type ProjectAgentAvatarScriptMode = 'user_script' | 'agent_authored';

export type ProjectAgentAvatarSceneDraft = {
  sceneIndex: number;
  prompt: Record<string, unknown>;
  status?: string | null;
  videoUrl?: string | null;
  errorMessage?: string | null;
};

export type ProjectAgentAvatarDraft = {
  status: 'idle' | 'drafting' | 'ready' | 'failed';
  scriptMode: ProjectAgentAvatarScriptMode;
  scriptSource: string;
  imagePrompt: string | null;
  coverImageUrl?: string | null;
  scenes: ProjectAgentAvatarSceneDraft[];
  error?: string | null;
};

export type ProjectAgentAvatarExecutionPhase =
  | 'idle'
  | 'generating_cover'
  | 'reviewing_cover'
  | 'generating_videos'
  | 'completed'
  | 'failed';

export type ProjectAgentAvatarExecutionScene = {
  sceneNumber: number;
  status: string;
  videoUrl?: string | null;
  errorMessage?: string | null;
};

export type ProjectAgentAvatarExecution = {
  projectId: string;
  phase: ProjectAgentAvatarExecutionPhase;
  model: VideoModel;
  finalVideoUrl?: string | null;
  coverImageUrl?: string | null;
  scenes: ProjectAgentAvatarExecutionScene[];
  error?: string | null;
};

export type AvatarProjectLike = {
  id: string;
  status?: string | null;
  current_step?: string | null;
  video_model?: string | null;
  generated_prompts?: Record<string, unknown> | null;
  generated_image_url?: string | null;
  image_prompt?: string | null;
  merged_video_url?: string | null;
  error_message?: string | null;
  custom_dialogue?: string | null;
};

export type AvatarSceneLike = {
  scene_number: number;
  status?: string | null;
  video_url?: string | null;
  error_message?: string | null;
};

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

export const normalizeProjectAgentAvatarStage = (
  input?: string | null
): ProjectAgentAvatarStage => {
  switch (input) {
    case 'avatar_asset_selection':
    case 'avatar_script_collection':
    case 'avatar_workspace':
    case 'avatar_generating_cover':
    case 'avatar_reviewing_cover':
    case 'avatar_generating_video':
    case 'avatar_completed':
      return input;
    case 'collecting':
      return 'avatar_asset_selection';
    case 'creating':
    case 'generating_prompts':
    case 'generating_image':
    case 'regenerating_image':
      return 'avatar_generating_cover';
    case 'awaiting_review':
      return 'avatar_reviewing_cover';
    case 'generating_videos':
    case 'merging_videos':
      return 'avatar_generating_video';
    case 'completed':
      return 'avatar_completed';
    default:
      return 'avatar_asset_selection';
  }
};

export const mapProjectAgentAvatarExecutionPhase = (
  status?: string | null,
  currentStep?: string | null
): ProjectAgentAvatarExecutionPhase => {
  const step = currentStep || status || '';
  switch (step) {
    case 'creating':
    case 'generating_prompts':
    case 'generating_image':
    case 'regenerating_image':
      return 'generating_cover';
    case 'awaiting_review':
      return 'reviewing_cover';
    case 'generating_videos':
    case 'merging_videos':
      return 'generating_videos';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
};

export const inferProjectAgentAvatarStage = (input: {
  explicitStage?: string | null;
  hasAvatar?: boolean;
  hasDraft?: boolean;
  hasCover?: boolean;
  projectStatus?: string | null;
  currentStep?: string | null;
  hasExecution?: boolean;
}): ProjectAgentAvatarStage => {
  const phase = mapProjectAgentAvatarExecutionPhase(input.projectStatus, input.currentStep);
  if (phase === 'generating_cover') return 'avatar_generating_cover';
  if (phase === 'reviewing_cover') return 'avatar_reviewing_cover';
  if (phase === 'generating_videos') return 'avatar_generating_video';
  if (phase === 'completed') return 'avatar_completed';

  if (input.explicitStage) {
    const explicitStage = normalizeProjectAgentAvatarStage(input.explicitStage);
    if (
      explicitStage === 'avatar_asset_selection' ||
      explicitStage === 'avatar_script_collection' ||
      explicitStage === 'avatar_workspace'
    ) {
      return explicitStage;
    }
  }

  if (!input.hasAvatar) return 'avatar_asset_selection';
  if (!input.hasDraft && !input.hasCover) return 'avatar_script_collection';
  if (input.hasExecution || input.hasDraft || input.hasCover) return 'avatar_workspace';
  return 'avatar_asset_selection';
};

export const extractAvatarPromptScenes = (
  generatedPrompts: Record<string, unknown> | null | undefined
): ProjectAgentAvatarSceneDraft[] => {
  const scenes = Array.isArray(generatedPrompts?.scenes)
    ? generatedPrompts.scenes as Array<{ prompt?: Record<string, unknown> | null }>
    : [];

  return scenes.map((scene, index) => ({
    sceneIndex: index + 1,
    prompt: (scene?.prompt && typeof scene.prompt === 'object')
      ? scene.prompt
      : {}
  }));
};

export const buildProjectAgentAvatarDraft = (
  project: AvatarProjectLike | null | undefined,
  sceneRows?: AvatarSceneLike[] | null,
  selections?: {
    avatarName?: string | null;
    productName?: string | null;
  } | null
): ProjectAgentAvatarDraft | null => {
  if (!project) return null;

  const promptScenes = extractAvatarPromptScenes(project.generated_prompts);
  const sceneByNumber = new Map((sceneRows || []).map((scene) => [scene.scene_number, scene]));
  const scenes = promptScenes.map((scene) => {
    const sceneRow = sceneByNumber.get(scene.sceneIndex);
    return {
      ...scene,
      status: sceneRow?.status ?? null,
      videoUrl: sceneRow?.video_url ?? null,
      errorMessage: sceneRow?.error_message ?? null
    };
  });

  const explicitScript = isNonEmptyString(project.custom_dialogue)
    ? project.custom_dialogue.trim()
    : '';
  const inferredScriptSource = scenes
    .map((scene) => scene.prompt)
    .map((prompt) => {
      if (isNonEmptyString(prompt.dialog)) return prompt.dialog.trim();
      if (isNonEmptyString(prompt.dialogue)) return String(prompt.dialogue).trim();
      return '';
    })
    .filter(Boolean)
    .join(' ');

  const phase = mapProjectAgentAvatarExecutionPhase(project.status, project.current_step);
  const status = project.generated_prompts
    ? 'ready'
    : phase === 'failed'
      ? 'failed'
      : phase === 'generating_cover'
        ? 'drafting'
        : 'idle';

  return {
    status,
    scriptMode: explicitScript ? 'user_script' : 'agent_authored',
    scriptSource: explicitScript || inferredScriptSource,
    imagePrompt: ensureAvatarImagePromptMentions({
      imagePrompt: isNonEmptyString(project.image_prompt) ? project.image_prompt.trim() : null,
      avatarName: selections?.avatarName,
      productName: selections?.productName
    }) || null,
    coverImageUrl: project.generated_image_url ?? null,
    scenes,
    error: project.error_message ?? null
  };
};

export const buildProjectAgentAvatarExecution = (
  project: AvatarProjectLike | null | undefined,
  sceneRows?: AvatarSceneLike[] | null
): ProjectAgentAvatarExecution | null => {
  if (!project?.id) return null;

  const phase = mapProjectAgentAvatarExecutionPhase(project.status, project.current_step);
  const scenes = (sceneRows || []).map((scene) => ({
    sceneNumber: scene.scene_number,
    status: scene.status || 'queued',
    videoUrl: scene.video_url ?? null,
    errorMessage: scene.error_message ?? null
  }));

  return {
    projectId: project.id,
    phase,
    model: (project.video_model as VideoModel) || 'seedance_2_mini',
    finalVideoUrl: project.merged_video_url ?? null,
    coverImageUrl: project.generated_image_url ?? null,
    scenes,
    error: project.error_message ?? null
  };
};
