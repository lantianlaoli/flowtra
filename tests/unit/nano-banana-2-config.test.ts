import test from 'node:test';
import assert from 'node:assert/strict';

import { IMAGE_MODELS, getActualImageModel } from '@/lib/constants';

test('registers nano banana 2 as a supported image model constant', () => {
  assert.equal(IMAGE_MODELS.nano_banana_2, 'nano-banana-2');
});

test('preserves nano banana 2 when resolving actual image model', () => {
  assert.equal(getActualImageModel('nano_banana_2'), 'nano_banana_2');
});
