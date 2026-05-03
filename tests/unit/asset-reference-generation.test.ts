import test from 'node:test';
import assert from 'node:assert/strict';

import { ANGLE_PRESETS } from '@/lib/ai-reference-angle-presets';
import { PRODUCT_REFERENCE_GENERATION_ASSET_TYPE } from '@/lib/asset-reference-generation';

test('product asset reference generation reuses the public multi-angle tool preset path', () => {
  assert.equal(PRODUCT_REFERENCE_GENERATION_ASSET_TYPE, 'universal');
});

test('public multi-angle tool preset order matches product reference slots', () => {
  assert.deepEqual(
    ANGLE_PRESETS[PRODUCT_REFERENCE_GENERATION_ASSET_TYPE].map((preset) => preset.key),
    ['front_left_45', 'front_right_45', 'back_view']
  );
});
