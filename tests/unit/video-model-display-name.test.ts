import test from 'node:test';
import assert from 'node:assert/strict';
import { getVideoModelDisplayName } from '@/lib/video-model-display-name';

test('generic Kling and Motion Clone expose distinct public names', () => {
  assert.equal(getVideoModelDisplayName('kling_3'), 'Kling 3.0');
  assert.equal(getVideoModelDisplayName('kling_3', { feature: 'motion_clone' }), 'Kling 3.0 Motion Control');
});
