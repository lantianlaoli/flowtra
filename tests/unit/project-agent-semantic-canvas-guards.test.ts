import test from 'node:test';
import assert from 'node:assert/strict';

import { safelyResolveSemanticCanvasStep } from '@/lib/project-agent/semantic-canvas-guards';

test('safelyResolveSemanticCanvasStep returns the resolver value when successful', async () => {
  const result = await safelyResolveSemanticCanvasStep({
    step: 'video_clone',
    latestUserTurn: 'Use Decorations 1 for red lapel pin.',
    workflow: 'video_clone',
    fn: async () => 'ok',
  });

  assert.equal(result, 'ok');
});

test('safelyResolveSemanticCanvasStep swallows resolver errors and returns null', async () => {
  const result = await safelyResolveSemanticCanvasStep({
    step: 'video_clone',
    latestUserTurn: 'Build a video clone workflow for red lapel pin using Decorations 1.',
    workflow: 'video_clone',
    fn: async () => {
      throw new Error('boom');
    },
  });

  assert.equal(result, null);
});
