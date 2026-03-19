import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMotionClonePromptDrafts,
  inferMotionCloneStage,
  mapMotionClonePhaseFromStatus,
  toMotionCloneExecutionFromProject,
} from '@/lib/project-agent/motion-clone-execution';

test('maps motion clone project statuses to agent phases', () => {
  assert.equal(mapMotionClonePhaseFromStatus('generating_preview'), 'generating_preview');
  assert.equal(mapMotionClonePhaseFromStatus('preview_ready'), 'preview_ready');
  assert.equal(mapMotionClonePhaseFromStatus('generating_video'), 'generating_video');
  assert.equal(mapMotionClonePhaseFromStatus('completed'), 'completed');
  assert.equal(mapMotionClonePhaseFromStatus('failed'), 'failed');
  assert.equal(mapMotionClonePhaseFromStatus('pending'), 'idle');
});

test('builds motion clone execution snapshot from project payload', () => {
  const execution = toMotionCloneExecutionFromProject({
    id: 'project-1',
    status: 'preview_ready',
    photo_prompt: 'Replace the subject',
    video_prompt: 'Keep the same motion',
    preview_image_url: 'https://cdn.example/preview.png',
    output_video_url: null,
    mode: '1080p',
    reference_duration_seconds: 12,
    credits_cost: 324,
    error_message: null,
  }, {
    referenceVideo: {
      id: 'video-1',
      description: 'Reference clip'
    },
    selectedAvatar: {
      id: 'avatar-1',
      name: 'Ava'
    }
  });

  assert.equal(execution.projectId, 'project-1');
  assert.equal(execution.stage, 'workspace');
  assert.equal(execution.phase, 'preview_ready');
  assert.equal(execution.photoPrompt, 'Replace the subject');
  assert.equal(execution.videoPrompt, 'Keep the same motion');
  assert.equal(execution.previewImageUrl, 'https://cdn.example/preview.png');
  assert.equal(execution.videoQuality, '1080p');
  assert.equal(execution.durationSeconds, 12);
  assert.equal(execution.creditsCost, 324);
  assert.equal(execution.referenceVideo?.id, 'video-1');
  assert.equal(execution.selectedAvatar?.id, 'avatar-1');
  assert.equal(execution.promptsInitialized, true);
});

test('infers motion clone stage from current selections', () => {
  assert.equal(inferMotionCloneStage(), 'reference_selection');
  assert.equal(inferMotionCloneStage({
    referenceVideo: { id: 'video-1' }
  }), 'replacement_selection');
  assert.equal(inferMotionCloneStage({
    referenceVideo: { id: 'video-1' },
    selectedAvatar: { id: 'avatar-1', name: 'Ava' }
  }), 'workspace');
});

test('builds prompt drafts from avatar and optional product selections', () => {
  const avatarOnly = buildMotionClonePromptDrafts({ avatarName: 'Ava' });
  assert.match(avatarOnly.photoPrompt, /Ava/);
  assert.match(avatarOnly.videoPrompt, /Only swap the person/);

  const withProduct = buildMotionClonePromptDrafts({
    avatarName: 'Ava',
    productName: 'Bottle'
  });
  assert.match(withProduct.photoPrompt, /Ava/);
  assert.match(withProduct.photoPrompt, /Bottle/);
  assert.match(withProduct.videoPrompt, /Only swap the person and product/);
});
