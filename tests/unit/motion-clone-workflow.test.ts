import test from 'node:test';
import assert from 'node:assert/strict';

import { getMotionCloneGenerationCost, normalizeMotionCloneQuality } from '@/lib/constants';
import {
  __test__,
  buildMotionClonePreviewPrompt,
  buildMotionCloneVideoPrompt,
} from '@/lib/motion-clone-workflow';

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

test('motion clone preview prompt keeps image 1 as the base frame for avatar-only swaps', () => {
  const prompt = buildMotionClonePreviewPrompt({
    hasAvatar: true,
    hasProduct: false,
    avatarLabel: '@(Default Female)',
  });

  assert.match(prompt, /authoritative base frame/i);
  assert.match(prompt, /Replace only the on-screen person with @\(Default Female\) from image 2\./);
  assert.match(prompt, /Preserve the original product or bottle\./);
  assert.match(prompt, /Preserve all non-target props, tools, handheld objects, hand-object interactions/i);
  assert.match(prompt, /Do not use them as the style, composition, pose, framing, or lighting baseline\./);
});

test('motion clone preview prompt preserves the original person for product-only swaps', () => {
  const prompt = buildMotionClonePreviewPrompt({
    hasAvatar: false,
    hasProduct: true,
    productLabel: '@(morphe brush)',
  });

  assert.match(prompt, /Replace only every visible product or bottle with @\(morphe brush\) from image 2\./);
  assert.match(prompt, /Preserve the original person\./);
  assert.match(prompt, /Preserve all non-target props, tools, handheld objects, hand-object interactions/i);
});

test('motion clone preview prompt preserves non-target props for avatar and product swaps', () => {
  const prompt = buildMotionClonePreviewPrompt({
    hasAvatar: true,
    hasProduct: true,
    avatarLabel: '@(Default Female)',
    productLabel: '@(morphe brush)',
  });

  assert.match(prompt, /Replace the on-screen person with @\(Default Female\) from image 2\./);
  assert.match(prompt, /Replace every visible product or bottle with @\(morphe brush\) from image 3\./);
  assert.match(prompt, /Image 1 must control the composition, pose, hand placement, occlusion, camera angle, framing, lighting, background, overlays, and color grading\./);
  assert.match(prompt, /Do not remove or redesign any non-target object\./);
});

test('motion clone video prompt preserves non-target props and scene composition', () => {
  const prompt = buildMotionCloneVideoPrompt({
    hasAvatar: true,
    hasProduct: true,
  });

  assert.match(prompt, /appearance guide only for the targeted person and product/i);
  assert.match(prompt, /Preserve the original motion, background, lighting, framing, hand placement, props, tools, and all untouched scene elements/i);
  assert.match(prompt, /Change only the explicitly targeted person and\/or product\./);
});
