import test from 'node:test';
import assert from 'node:assert/strict';

import { NON_AGENT_IMAGE_MODEL } from '@/lib/constants';

test('uses gpt-image-2-image-to-image as the shared image model constant', () => {
  assert.equal(NON_AGENT_IMAGE_MODEL, 'gpt-image-2-image-to-image');
});
