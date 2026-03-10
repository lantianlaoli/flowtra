type ProjectAgentPromptChipState = {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';
  step?: string;
  projectId?: string;
  cloneReferenceVideo?: {
    id?: string | null;
  } | null;
  cloneReplacementDraft?: {
    status?: 'idle' | 'generating' | 'ready' | 'awaiting_confirmation' | 'failed';
    scenes?: Array<unknown>;
  } | null;
  cloneExecution?: {
    projectId?: string;
    phase?: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
    mergedVideoUrl?: string | null;
  } | null;
};

export type ProjectAgentPromptChipStage =
  | 'starter'
  | 'reference_planning'
  | 'draft_review'
  | 'frame_generation'
  | 'frame_review'
  | 'video_generation'
  | 'completed';

const CHIP_POOLS: Record<ProjectAgentPromptChipStage, string[]> = {
  starter: [
    'I want to clone a viral video',
    'Show me reference videos',
    'Find a video to clone',
    'Help me choose a reference video'
  ],
  reference_planning: [
    'Use this product',
    'Use this avatar and product',
    'Show scene assignments',
    'Continue with this reference'
  ],
  draft_review: [
    'start frame generation',
    'Show scene assignments',
    'Help me rewrite scene 2',
    'Use this product'
  ],
  frame_generation: [
    'show me the latest progress',
    'Which scenes are ready?',
    'regenerate scene 2 frame',
    'When can I start video generation?'
  ],
  frame_review: [
    'start video generation',
    'regenerate scene 2 frame',
    'show me the latest progress',
    'Which scenes are ready?'
  ],
  video_generation: [
    'create final video',
    'regenerate scene 2 video',
    'show me the latest progress',
    'Which scene videos are ready?'
  ],
  completed: [
    'clone another video',
    'show more reference videos',
    'where can I download it',
    'show me the final video'
  ]
};

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

export const getProjectAgentPromptChipStage = (
  state: ProjectAgentPromptChipState
): ProjectAgentPromptChipStage | null => {
  const clonePhase = state.cloneExecution?.phase;
  const hasReference = Boolean(state.cloneReferenceVideo?.id);
  const hasMergedVideo = Boolean(state.cloneExecution?.mergedVideoUrl);
  const draftStatus = state.cloneReplacementDraft?.status ?? 'idle';
  const hasDraftScenes = (state.cloneReplacementDraft?.scenes?.length ?? 0) > 0;
  const hasCloneExecution = Boolean(state.cloneExecution?.projectId);
  const hasActiveAvatarProject = state.intent === 'avatar_ads' && Boolean(state.projectId);

  if (hasMergedVideo || clonePhase === 'merging' || clonePhase === 'completed') {
    return 'completed';
  }

  if (clonePhase === 'generating_videos' || clonePhase === 'awaiting_merge') {
    return 'video_generation';
  }

  if (clonePhase === 'reviewing_frames') {
    return 'frame_review';
  }

  if (clonePhase === 'generating_frames') {
    return 'frame_generation';
  }

  if (hasReference && (draftStatus === 'ready' || hasDraftScenes || hasCloneExecution)) {
    return 'draft_review';
  }

  if (hasReference) {
    return 'reference_planning';
  }

  if (hasActiveAvatarProject) {
    return null;
  }

  return 'starter';
};

export const getProjectAgentPromptChipPool = (
  stage: ProjectAgentPromptChipStage | null
) => (stage ? CHIP_POOLS[stage] : []);

export const getProjectAgentPromptChipStageKey = (state: ProjectAgentPromptChipState) => {
  const stage = getProjectAgentPromptChipStage(state);
  if (!stage) return 'hidden';

  const referenceId = state.cloneReferenceVideo?.id || 'none';
  const projectId = state.cloneExecution?.projectId || state.projectId || 'none';
  const draftStatus = state.cloneReplacementDraft?.status || 'idle';
  const sceneCount = state.cloneReplacementDraft?.scenes?.length ?? 0;
  const phase = state.cloneExecution?.phase || 'idle';
  const merged = state.cloneExecution?.mergedVideoUrl ? 'merged' : 'not-merged';

  return [stage, referenceId, projectId, draftStatus, sceneCount, phase, merged].join(':');
};

export const getProjectAgentPromptChips = (
  state: ProjectAgentPromptChipState
) => {
  const stage = getProjectAgentPromptChipStage(state);
  const pool = getProjectAgentPromptChipPool(stage);
  const stageKey = getProjectAgentPromptChipStageKey(state);

  if (!stage || pool.length === 0) {
    return {
      stage,
      stageKey,
      chips: [] as string[]
    };
  }

  const shuffled = [...pool].sort((left, right) => {
    const leftHash = stableHash(`${stageKey}:${left}`);
    const rightHash = stableHash(`${stageKey}:${right}`);
    return leftHash - rightHash;
  });
  const visibleCount = Math.min(pool.length, 3 + (stableHash(stageKey) % 2));

  return {
    stage,
    stageKey,
    chips: shuffled.slice(0, visibleCount)
  };
};
