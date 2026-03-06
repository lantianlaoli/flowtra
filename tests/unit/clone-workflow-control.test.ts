import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MERGE_CONFIRMATION_TOKEN,
  REPLACEMENT_CONFIRMATION_TOKEN,
  isMergeConfirmationCommand,
  isMergeIntentCommand,
  isReplacementConfirmationCommand,
  isStartVideoGenerationCommand,
  isRegenerateVideoCommand,
  mapClonePhaseFromStatusPayload
} from '@/lib/project-agent/clone-workflow-control';

test('detects merge intent commands in EN and ZH', () => {
  assert.equal(isMergeIntentCommand('please merge videos now'), true);
  assert.equal(isMergeIntentCommand('请帮我合并视频'), true);
  assert.equal(isMergeIntentCommand('start video generation'), false);
});

test('detects merge confirmation token', () => {
  assert.equal(isMergeConfirmationCommand(MERGE_CONFIRMATION_TOKEN), true);
  assert.equal(isMergeConfirmationCommand('create final video'), true);
  assert.equal(isMergeConfirmationCommand('confirm merge'), true);
  assert.equal(isMergeConfirmationCommand('merge now'), false);
});

test('detects replacement confirmation token', () => {
  assert.equal(isReplacementConfirmationCommand(REPLACEMENT_CONFIRMATION_TOKEN), true);
  assert.equal(isReplacementConfirmationCommand('confirm replacements'), true);
  assert.equal(isReplacementConfirmationCommand('confirm replacement'), false);
});

test('detects scene video regeneration command', () => {
  assert.equal(isRegenerateVideoCommand('regenerate scene 2 video'), true);
  assert.equal(isRegenerateVideoCommand('重生成第2个视频'), true);
  assert.equal(isRegenerateVideoCommand('regenerate scene 2 frame'), false);
});

test('detects flexible start video generation commands', () => {
  assert.equal(isStartVideoGenerationCommand('start video generation'), true);
  assert.equal(isStartVideoGenerationCommand('start scene 1 video generation'), true);
  assert.equal(isStartVideoGenerationCommand('开始视频生成'), true);
  assert.equal(isStartVideoGenerationCommand('regenerate scene 2 video'), false);
});

test('maps awaiting_merge status to awaiting_merge phase', () => {
  const phase = mapClonePhaseFromStatusPayload({
    status: 'awaiting_merge',
    current_step: 'awaiting_merge',
    data: {
      segmentStatus: {
        total: 3,
        framesReady: 3,
        videosReady: 3
      }
    }
  });

  assert.equal(phase, 'awaiting_merge');
});
