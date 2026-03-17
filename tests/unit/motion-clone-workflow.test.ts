import test from 'node:test';
import assert from 'node:assert/strict';

import { getMotionCloneGenerationCost, normalizeMotionCloneQuality } from '@/lib/constants';
import { __test__ } from '@/lib/motion-clone-workflow';

test('motion clone request body uses Kling 3.0 and defaults to 720p', () => {
  const requestBody = __test__.buildMotionCloneVideoRequestBody({
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

test('motion clone request body passes through selected 1080p quality', () => {
  const requestBody = __test__.buildMotionCloneVideoRequestBody({
    previewImageUrl: 'https://example.com/preview.png',
    referenceVideoUrl: 'https://example.com/reference.mp4',
    mode: '1080p',
    callbackUrl: 'https://example.com/callback'
  }) as {
    input: Record<string, unknown>;
  };

  assert.equal(requestBody.input.mode, '1080p');
});

test('motion clone pricing uses quality-based per-second rates', () => {
  assert.equal(getMotionCloneGenerationCost(5, '720p'), 100);
  assert.equal(getMotionCloneGenerationCost(5, '1080p'), 135);
  assert.equal(getMotionCloneGenerationCost(5.2, '720p'), 120);
});

test('motion clone quality normalization falls back to 720p', () => {
  assert.equal(normalizeMotionCloneQuality('1080p'), '1080p');
  assert.equal(normalizeMotionCloneQuality('720p'), '720p');
  assert.equal(normalizeMotionCloneQuality('std'), '720p');
  assert.equal(normalizeMotionCloneQuality(undefined), '720p');
});
