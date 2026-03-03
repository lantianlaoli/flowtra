import test from 'node:test';
import assert from 'node:assert/strict';

import { NON_AGENT_IMAGE_MODEL } from '@/lib/constants';

test('keeps nano banana 2 as the only shared image model constant', () => {
  assert.equal(NON_AGENT_IMAGE_MODEL, 'nano-banana-2');
});
