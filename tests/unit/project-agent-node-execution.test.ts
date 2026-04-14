import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAvatarAdsStartPayload,
  buildMotionCloneStartPayload,
  buildVideoCloneStartPayload,
  normalizeAvatarExecutionStatus,
  normalizeCloneExecutionStatus,
  normalizeMotionCloneExecutionStatus,
} from '@/lib/project-agent/node-execution';

test('buildVideoCloneStartPayload maps connected assets into clone request fields', () => {
  const payload = buildVideoCloneStartPayload({
    avatar: { id: 'avatar-1', name: 'Avatar' },
    video: { id: 'video-1', name: 'Video', sourceType: 'creator', analysisLanguage: 'en' },
    config: { videoDuration: '16', videoModel: 'seedance_2', videoQuality: '720p', aspectRatio: '9:16', language: 'en' },
  });

  assert.equal(payload.creatorSourceVideoId, 'video-1');
  assert.equal(payload.referenceVideoId, undefined);
  assert.deepEqual(payload.selectedAvatarIds, ['avatar-1']);
  assert.deepEqual(payload.selectedProductIds, []);
  assert.equal(payload.videoDuration, '16');
  assert.equal(payload.videoModel, 'kling_3');
});

test('buildVideoCloneStartPayload supports product-only replacements', () => {
  const payload = buildVideoCloneStartPayload({
    product: { id: 'product-1', name: 'Product' },
    video: { id: 'video-1', name: 'Video', sourceType: 'reference_video', analysisLanguage: 'en' },
  });

  assert.equal(payload.creatorSourceVideoId, undefined);
  assert.equal(payload.referenceVideoId, 'video-1');
  assert.deepEqual(payload.selectedAvatarIds, []);
  assert.deepEqual(payload.selectedProductIds, ['product-1']);
});

test('buildVideoCloneStartPayload includes trimmed supplemental text guidance', () => {
  const payload = buildVideoCloneStartPayload({
    product: { id: 'product-1', name: 'Bubble machine' },
    text: { id: 'text-1', name: 'Text', content: '  Bubbles should emerge from the front nozzle after the motor starts.  ' },
    video: { id: 'video-1', name: 'Video', sourceType: 'reference_video', analysisLanguage: 'en' },
  });

  assert.equal(payload.supplementalText, 'Bubbles should emerge from the front nozzle after the motor starts.');
});

test('buildAvatarAdsStartPayload keeps strict avatar and product requirements', () => {
  const payload = buildAvatarAdsStartPayload({
    avatar: { id: 'avatar-1', name: 'Avatar', imageUrl: 'https://example.com/avatar.png' },
    product: { id: 'product-1', name: 'Product' },
    config: { videoDuration: '16', aspectRatio: '9:16', language: 'en', videoModel: 'seedance_2_fast' },
  });

  assert.equal(payload.selectedPersonPhotoUrl, 'https://example.com/avatar.png');
  assert.equal(payload.selectedProductId, 'product-1');
  assert.equal(payload.videoDurationSeconds, 16);
  assert.equal(payload.videoModel, 'kling_3');
});

test('buildAvatarAdsStartPayload resolves spoken language from custom dialogue', () => {
  const payload = buildAvatarAdsStartPayload({
    avatar: { id: 'avatar-1', name: 'Avatar', imageUrl: 'https://example.com/avatar.png' },
    product: { id: 'product-1', name: 'Product' },
    text: { id: 'text-1', name: 'Text', content: '这款草本清风包，清香淡雅，帮助舒缓压力。' },
    config: { videoDuration: '16', aspectRatio: '9:16', language: 'en', videoModel: 'kling_3' },
  });

  assert.equal(payload.language, 'zh');
  assert.equal(payload.resolvedSpokenLanguage, 'zh');
});

test('buildMotionCloneStartPayload keeps creator video linkage', () => {
  const payload = buildMotionCloneStartPayload({
    avatar: { id: 'avatar-1', name: 'Avatar' },
    product: { id: 'product-1', name: 'Product' },
    video: { id: 'video-1', name: 'Video', sourceType: 'creator' },
    config: { videoQuality: '1080p' },
  });

  assert.equal(payload.referenceVideoId, 'video-1');
  assert.equal(payload.mode, '1080p');
  assert.equal(payload.action, 'video');
});

test('normalizeCloneExecutionStatus requests automatic downstream actions', () => {
  const startVideoStatus = normalizeCloneExecutionStatus({
    status: 'ready_for_video',
    current_step: 'ready_for_video',
    progress_percentage: 60,
    data: { coverImageUrl: 'https://example.com/cover.png' },
  });
  assert.equal(startVideoStatus.nextAction, 'start_clone_video');

  const mergeStatus = normalizeCloneExecutionStatus({
    status: 'awaiting_merge',
    current_step: 'awaiting_merge',
    data: { awaitingMerge: true },
  });
  assert.equal(mergeStatus.nextAction, 'merge_clone_video');
});

test('normalizeAvatarExecutionStatus auto-confirms review state', () => {
  const status = normalizeAvatarExecutionStatus({
    project: {
      id: 'project-1',
      status: 'awaiting_review',
      progress_percentage: 52,
      generated_image_url: 'https://example.com/cover.png',
    },
  });

  assert.equal(status.nextAction, 'confirm_avatar');
  assert.equal(status.previewUrl, 'https://example.com/cover.png');
  assert.equal(status.currentMilestoneKey, 'generating_cover');
  assert.equal(status.milestones[1]?.state, 'active');
});

test('normalizeCloneExecutionStatus returns simplified milestones', () => {
  const status = normalizeCloneExecutionStatus({
    status: 'awaiting_merge',
    current_step: 'awaiting_merge',
    data: { awaitingMerge: true },
  });

  assert.equal(status.currentMilestoneKey, 'merging');
  assert.equal(status.milestones.find((item) => item.key === 'merging')?.state, 'active');
});

test('normalizeMotionCloneExecutionStatus returns progress milestones', () => {
  const status = normalizeMotionCloneExecutionStatus({
    project: {
      id: 'motion-1',
      status: 'generating_preview',
    },
  });

  assert.equal(status.currentMilestoneKey, 'generating_preview');
  assert.equal(status.milestones.find((item) => item.key === 'generating_preview')?.state, 'active');
});
