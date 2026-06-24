import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDashboardDirectReferenceRequestOptions,
  getDashboardVideoCloneDuration,
} from '@/lib/video-clone-direct-reference';

test('uses direct reference mode for a 14s Seedance 2 Mini video with a playable URL', () => {
  const options = getDashboardDirectReferenceRequestOptions({
    model: 'seedance_2_mini',
    durationSeconds: 14,
    videoUrl: '',
    videoCdnUrl: 'https://example.com/reference.mp4',
  });

  assert.deepEqual(options, {
    requestSource: 'project_agent_clone',
    executionMode: 'clone_direct_reference',
    referenceSourceVideoUrl: 'https://example.com/reference.mp4',
    videoDuration: '14',
  });
});

test('keeps unsupported direct reference inputs on segmented dashboard mode', () => {
  assert.equal(
    getDashboardDirectReferenceRequestOptions({
      model: 'seedance_2_mini',
      durationSeconds: 16,
      videoUrl: 'https://example.com/reference.mp4',
      videoCdnUrl: null,
    }),
    null
  );

  assert.equal(
    getDashboardDirectReferenceRequestOptions({
      model: 'kling_3',
      durationSeconds: 14,
      videoUrl: 'https://example.com/reference.mp4',
      videoCdnUrl: null,
    }),
    null
  );

  assert.equal(
    getDashboardDirectReferenceRequestOptions({
      model: 'seedance_2_mini',
      durationSeconds: 14,
      videoUrl: '',
      videoCdnUrl: '',
    }),
    null
  );
});

test('preserves exact direct reference duration and otherwise uses snapped duration', () => {
  assert.equal(
    getDashboardVideoCloneDuration({
      model: 'seedance_2_mini',
      referenceDurationSeconds: 14,
      defaultDuration: '8',
      directReferenceOptions: {
        requestSource: 'project_agent_clone',
        executionMode: 'clone_direct_reference',
        referenceSourceVideoUrl: 'https://example.com/reference.mp4',
        videoDuration: '14',
      },
    }),
    '14'
  );

  assert.equal(
    getDashboardVideoCloneDuration({
      model: 'seedance_2_mini',
      referenceDurationSeconds: 16,
      defaultDuration: '8',
      directReferenceOptions: null,
    }),
    '16'
  );
});
