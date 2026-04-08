import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getProjectAgentPromptChipPool,
  getProjectAgentPromptChips,
  getProjectAgentPromptChipStage,
  getProjectAgentPromptChipStageKey,
} from '@/lib/project-agent/prompt-chips';

test('fresh state returns starter clone prompts', () => {
  const stage = getProjectAgentPromptChipStage({});
  assert.equal(stage, 'starter');
  assert.deepEqual(getProjectAgentPromptChipPool(stage), [
    'I want to clone a viral video',
    'I want to make an avatar ad',
    'I want to use motion clone'
  ]);
});

test('visible reference selection returns clone reference chips', () => {
  const stage = getProjectAgentPromptChipStage({
    showCloneableVideos: true
  });
  assert.equal(stage, 'clone_reference_selection');
  assert.deepEqual(getProjectAgentPromptChipPool(stage), [
    'Show me reference videos',
    'Help me choose a reference video',
    'What makes a good reference video?'
  ]);
});

test('visible replacement selection returns clone replacement chips', () => {
  const stage = getProjectAgentPromptChipStage({
    intent: 'video_clone',
    cloneReferenceVideo: { id: 'ref-1' },
    showCloneReplacementSelectors: true
  });
  assert.equal(stage, 'clone_replacement_selection');
});

test('workspace-ready state returns draft review guidance', () => {
  const stage = getProjectAgentPromptChipStage({
    intent: 'video_clone',
    cloneReferenceVideo: { id: 'ref-1' },
    cloneReplacementDraft: {
      status: 'ready',
      scenes: [{}, {}]
    }
  });
  assert.equal(stage, 'draft_review');
});

test('awaiting confirmation in visible workspace stays on draft review chips', () => {
  const stage = getProjectAgentPromptChipStage({
    intent: 'video_clone',
    cloneReferenceVideo: { id: 'ref-1' },
    cloneReplacementDraft: {
      status: 'awaiting_confirmation'
    },
    showCloneSceneWorkspaceStep: true
  });
  assert.equal(stage, 'draft_review');
});

test('awaiting-merge and completed states prioritize final-step and next-clone prompts', () => {
  const awaitingMerge = getProjectAgentPromptChipStage({
    intent: 'video_clone',
    cloneExecution: {
      projectId: 'project-1',
      phase: 'awaiting_merge'
    }
  });
  assert.equal(awaitingMerge, 'video_generation');

  const completed = getProjectAgentPromptChipStage({
    intent: 'video_clone',
    cloneExecution: {
      projectId: 'project-1',
      phase: 'completed',
      mergedVideoUrl: 'https://cdn.example/final.mp4'
    }
  });
  assert.equal(completed, 'completed');

  const completedChips = getProjectAgentPromptChips({
    intent: 'video_clone',
    cloneExecution: {
      projectId: 'project-1',
      phase: 'completed',
      mergedVideoUrl: 'https://cdn.example/final.mp4'
    }
  }).chips;
  assert.ok(
    completedChips.includes('clone another video') || completedChips.includes('show more reference videos')
  );
});

test('chip selection returns only 3-4 items from the active stage pool', () => {
  const stage = getProjectAgentPromptChipStage({
    intent: 'video_clone',
    cloneExecution: {
      projectId: 'project-1',
      phase: 'generating_videos'
    }
  });
  const pool = getProjectAgentPromptChipPool(stage);
  const { chips } = getProjectAgentPromptChips({
    intent: 'video_clone',
    cloneExecution: {
      projectId: 'project-1',
      phase: 'generating_videos'
    }
  });

  assert.ok(chips.length >= 3 && chips.length <= 4);
  chips.forEach((chip) => {
    assert.ok(pool.includes(chip));
  });
});

test('chip selection stays stable for the same stage key and changes when stage changes', () => {
  const baseState = {
    intent: 'video_clone' as const,
    cloneReferenceVideo: { id: 'ref-1' },
    cloneReplacementDraft: {
      status: 'ready' as const,
      scenes: [{}, {}]
    }
  };

  const first = getProjectAgentPromptChips(baseState);
  const second = getProjectAgentPromptChips(baseState);
  assert.equal(getProjectAgentPromptChipStageKey(baseState), first.stageKey);
  assert.deepEqual(first.chips, second.chips);

  const referenceSelectionState = {
    showCloneableVideos: true
  };
  const referenceSelection = getProjectAgentPromptChips(referenceSelectionState);
  assert.notEqual(first.stageKey, referenceSelection.stageKey);

  const completedState = {
    intent: 'video_clone' as const,
    cloneExecution: {
      projectId: 'project-1',
      phase: 'completed' as const,
      mergedVideoUrl: 'https://cdn.example/final.mp4'
    }
  };
  const completed = getProjectAgentPromptChips(completedState);
  assert.notEqual(first.stageKey, completed.stageKey);
});

test('active avatar workflow shows avatar-stage prompt chips', () => {
  const visible = getProjectAgentPromptChips({
    intent: 'avatar_ads',
    projectId: 'avatar-project-1'
  });
  assert.ok(visible.chips.length >= 1);
  assert.equal(visible.stage, 'avatar_setup');
});

test('motion clone workflow exposes motion-stage chips', () => {
  const setup = getProjectAgentPromptChips({
    intent: 'motion_clone',
    motionClone: {
      stage: 'reference_selection'
    }
  });
  assert.equal(setup.stage, 'motion_reference_selection');

  const replacement = getProjectAgentPromptChips({
    intent: 'motion_clone',
    motionClone: {
      stage: 'replacement_selection',
      phase: 'idle'
    }
  });
  assert.equal(replacement.stage, 'motion_replacement_selection');

  const preview = getProjectAgentPromptChips({
    intent: 'motion_clone',
    motionClone: {
      stage: 'workspace',
      phase: 'preview_ready'
    }
  });
  assert.equal(preview.stage, 'motion_preview');

  const generatingVideo = getProjectAgentPromptChips({
    intent: 'motion_clone',
    motionClone: {
      stage: 'workspace',
      phase: 'generating_video'
    }
  });
  assert.equal(generatingVideo.stage, 'motion_video');
});
