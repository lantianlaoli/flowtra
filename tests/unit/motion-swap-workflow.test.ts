import test from 'node:test';
import assert from 'node:assert/strict';

import { getMotionSwapGenerationCost, normalizeMotionSwapQuality } from '@/lib/constants';
import { __test__ } from '@/lib/motion-swap-workflow';

test('motion swap request body uses Kling 3.0 and defaults to 720p', () => {
  const requestBody = __test__.buildMotionSwapVideoRequestBody({
    previewImageUrl: 'https://example.com/preview.png',
    referenceVideoUrl: 'https://example.com/reference.mp4',
    callbackUrl: 'https://example.com/callback'
  }) as {
    model: string;
    input: Record<string, unknown>;
  };

  assert.equal(requestBody.model, 'kling-3.0/motion-control');
  assert.equal(requestBody.input.mode, '720p');
});

test('motion swap request body passes through selected 1080p quality', () => {
  const requestBody = __test__.buildMotionSwapVideoRequestBody({
    previewImageUrl: 'https://example.com/preview.png',
    referenceVideoUrl: 'https://example.com/reference.mp4',
    mode: '1080p',
    callbackUrl: 'https://example.com/callback'
  }) as {
    input: Record<string, unknown>;
  };

  assert.equal(requestBody.input.mode, '1080p');
});

test('motion swap pricing uses quality-based per-second rates', () => {
  assert.equal(getMotionSwapGenerationCost(5, '720p'), 100);
  assert.equal(getMotionSwapGenerationCost(5, '1080p'), 135);
  assert.equal(getMotionSwapGenerationCost(5.2, '720p'), 120);
});

test('motion swap quality normalization falls back to 720p', () => {
  assert.equal(normalizeMotionSwapQuality('1080p'), '1080p');
  assert.equal(normalizeMotionSwapQuality('720p'), '720p');
  assert.equal(normalizeMotionSwapQuality('std'), '720p');
  assert.equal(normalizeMotionSwapQuality(undefined), '720p');
});
