type ProjectAgentPromptChipState = {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_clone';
  step?: string;
  avatarStage?: string;
  projectId?: string;
  showCloneableVideos?: boolean;
  showCloneReplacementSelectors?: boolean;
  showCloneSceneWorkspaceStep?: boolean;
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
  motionClone?: {
    stage?: 'reference_selection' | 'replacement_selection' | 'workspace';
    phase?: 'idle' | 'generating_preview' | 'preview_ready' | 'generating_video' | 'completed' | 'failed';
    hasSelectedAvatar?: boolean;
    hasSelectedProduct?: boolean;
  } | null;
};

export type ProjectAgentPromptChipStage =
  | 'starter'
  | 'avatar_setup'
  | 'avatar_review'
  | 'avatar_generating'
  | 'motion_reference_selection'
  | 'motion_replacement_selection'
  | 'motion_preview'
  | 'motion_video'
  | 'clone_reference_selection'
  | 'clone_replacement_selection'
  | 'draft_review'
  | 'frame_generation'
  | 'frame_review'
  | 'video_generation'
  | 'completed';

const CHIP_POOLS: Record<ProjectAgentPromptChipStage, string[]> = {
  starter: [
    'I want to clone a viral video',
    'I want to make an avatar ad',
    'I want to use motion clone'
  ],
  avatar_setup: [
    'Continue with current selection',
    'Continue without a product',
    'Use this avatar',
    'Choose a different avatar'
  ],
  avatar_review: [
    'Generate the cover',
    'Regenerate the cover',
    'Adjust the dialogue',
    'Generate the video'
  ],
  avatar_generating: [
    'Show me the latest progress',
    'Is the cover ready?',
    'Is the video ready?',
    'What happens next?'
  ],
  motion_reference_selection: [
    'Help me choose a reference video',
    'Show me more eligible videos',
    'What makes a good reference video?'
  ],
  motion_replacement_selection: [],
  motion_preview: [
    'Generate the preview image',
    'Rewrite the image prompt',
    'Rewrite the video prompt',
    'Show me the latest progress'
  ],
  motion_video: [
    'Generate the final video',
    'Regenerate the preview image',
    'Rewrite the video prompt',
    'Show me the latest progress'
  ],
  clone_reference_selection: [
    'Show me reference videos',
    'Help me choose a reference video',
    'What makes a good reference video?'
  ],
  clone_replacement_selection: [
    'Use this avatar',
    'Use this product',
    'Show draft preview',
    'Continue with current selections'
  ],
  draft_review: [
    'Show scene assignments',
    'Start frame generation',
    'Help me rewrite scene 2',
    'Generate this draft'
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
  const isCloneReferenceSelectionVisible = Boolean(state.showCloneableVideos);
  const isCloneReplacementSelectionVisible = Boolean(state.showCloneReplacementSelectors);
  const isCloneSceneWorkspaceVisible = Boolean(state.showCloneSceneWorkspaceStep);
  const hasReference = Boolean(state.cloneReferenceVideo?.id);
  const hasMergedVideo = Boolean(state.cloneExecution?.mergedVideoUrl);
  const draftStatus = state.cloneReplacementDraft?.status ?? 'idle';
  const hasDraftScenes = (state.cloneReplacementDraft?.scenes?.length ?? 0) > 0;
  const hasCloneExecution = Boolean(state.cloneExecution?.projectId);
  const motionPhase = state.intent === 'motion_clone' ? state.motionClone?.phase : undefined;
  const motionStage = state.intent === 'motion_clone' ? state.motionClone?.stage : undefined;
  const isCloneFlowActive = Boolean(
    state.intent === 'competitor_ugc_replication' ||
    isCloneReferenceSelectionVisible ||
    isCloneReplacementSelectionVisible ||
    isCloneSceneWorkspaceVisible ||
    hasReference ||
    hasCloneExecution ||
    draftStatus !== 'idle'
  );

  if (hasMergedVideo || clonePhase === 'merging' || clonePhase === 'completed') {
    return 'completed';
  }

  if (state.intent === 'avatar_ads') {
    if (state.avatarStage === 'avatar_reviewing_cover' || state.step === 'awaiting_review') {
      return 'avatar_review';
    }
    if (
      state.avatarStage === 'avatar_generating_cover' ||
      state.avatarStage === 'avatar_generating_video' ||
      (state.projectId &&
      state.step &&
      state.step !== 'collecting' &&
      state.step !== 'awaiting_review')
    ) {
      return 'avatar_generating';
    }
    return 'avatar_setup';
  }

  if (state.intent === 'motion_clone') {
    if (motionStage === 'reference_selection') {
      return 'motion_reference_selection';
    }
    if (motionStage === 'replacement_selection') {
      return 'motion_replacement_selection';
    }
    if (motionPhase === 'generating_preview' || motionPhase === 'preview_ready') {
      return 'motion_preview';
    }
    if (motionPhase === 'generating_video' || motionPhase === 'completed') {
      return 'motion_video';
    }
    return 'motion_preview';
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

  if (
    isCloneSceneWorkspaceVisible ||
    (hasReference && (
      draftStatus === 'ready' ||
      draftStatus === 'awaiting_confirmation' ||
      draftStatus === 'failed' ||
      hasDraftScenes ||
      hasCloneExecution
    ))
  ) {
    return 'draft_review';
  }

  if (isCloneReplacementSelectionVisible || hasReference) {
    return 'clone_replacement_selection';
  }

  if (isCloneReferenceSelectionVisible || isCloneFlowActive) {
    return 'clone_reference_selection';
  }
  return 'starter';
};

export const getProjectAgentPromptChipPool = (
  stage: ProjectAgentPromptChipStage | null,
  state?: ProjectAgentPromptChipState
) => {
  if (!stage) return [];

  if (stage === 'motion_replacement_selection') {
    const hasSelectedAvatar = Boolean(state?.motionClone?.hasSelectedAvatar);
    const hasSelectedProduct = Boolean(state?.motionClone?.hasSelectedProduct);

    if (!hasSelectedAvatar) {
      return hasSelectedProduct
        ? [
            'Use this avatar',
            'Continue with current selections',
            'Clear the product',
            'Choose a different avatar'
          ]
        : [
            'Use this avatar',
            'Continue with avatar only',
            'Use this product',
            'Choose a different avatar'
          ];
    }

    if (hasSelectedProduct) {
      return [
        'Continue with current selections',
        'Clear the product',
        'Choose a different avatar',
        'Use this product'
      ];
    }

    return [
      'Continue with avatar only',
      'Use this product',
      'Choose a different avatar',
      'Continue with current selections'
    ];
  }

  return CHIP_POOLS[stage];
};

export const getProjectAgentPromptChipStageKey = (state: ProjectAgentPromptChipState) => {
  const stage = getProjectAgentPromptChipStage(state);
  if (!stage) return 'hidden';

  const avatarStage = state.avatarStage || 'none';
  const referenceId = state.cloneReferenceVideo?.id || 'none';
  const projectId = state.cloneExecution?.projectId || state.projectId || 'none';
  const draftStatus = state.cloneReplacementDraft?.status || 'idle';
  const sceneCount = state.cloneReplacementDraft?.scenes?.length ?? 0;
  const phase = state.cloneExecution?.phase || 'idle';
  const merged = state.cloneExecution?.mergedVideoUrl ? 'merged' : 'not-merged';
  const cloneableVideos = state.showCloneableVideos ? 'clone-videos-visible' : 'clone-videos-hidden';
  const replacementSelectors = state.showCloneReplacementSelectors ? 'clone-selectors-visible' : 'clone-selectors-hidden';
  const sceneWorkspace = state.showCloneSceneWorkspaceStep ? 'clone-workspace-visible' : 'clone-workspace-hidden';
  const motionStage = state.motionClone?.stage || 'unset';
  const motionPhase = state.motionClone?.phase || 'idle';

  return [
    stage,
    avatarStage,
    referenceId,
    projectId,
    draftStatus,
    sceneCount,
    phase,
    merged,
    cloneableVideos,
    replacementSelectors,
    sceneWorkspace,
    motionStage,
    motionPhase
  ].join(':');
};

export const getProjectAgentPromptChips = (
  state: ProjectAgentPromptChipState
) => {
  const stage = getProjectAgentPromptChipStage(state);
  const pool = getProjectAgentPromptChipPool(stage, state);
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
