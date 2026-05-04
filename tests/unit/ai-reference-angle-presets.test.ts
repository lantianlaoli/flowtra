import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANGLE_PRESETS,
  getReferenceAngleAspectRatio,
  selectAnglePresets
} from '@/lib/ai-reference-angle-presets';

test('product AI reference presets match product slot order', () => {
  assert.deepEqual(
    ANGLE_PRESETS.product.map((preset) => preset.key),
    ['front_left_45', 'front_right_45', 'back_view']
  );
  assert.deepEqual(
    ANGLE_PRESETS.product.map((preset) => preset.label),
    ['45° Front Left', '45° Front Right', 'Back View']
  );
});

test('product AI reference preset slicing continues from existing slot count', () => {
  assert.deepEqual(
    selectAnglePresets('product', 1, 2).map((preset) => preset.key),
    ['front_right_45', 'back_view']
  );
  assert.deepEqual(
    selectAnglePresets('product', 2, 1).map((preset) => preset.key),
    ['back_view']
  );
});

test('product left and back prompts guard against swapped angles', () => {
  const [frontLeft, , backView] = ANGLE_PRESETS.product;

  assert.match(frontLeft.prompt, /front face plus the left side plane/i);
  assert.match(frontLeft.prompt, /Do not return a rear view, back view/i);
  assert.match(frontLeft.prompt, /rear panel must not be visible or dominant/i);

  assert.match(backView.prompt, /camera is directly behind the product/i);
  assert.match(backView.prompt, /back face, rear label, rear packaging details/i);
  assert.match(backView.prompt, /Do not generate a 45-degree front-left/i);
});

test('reference angle aspect ratios remain unchanged by preset extraction', () => {
  assert.equal(getReferenceAngleAspectRatio('product'), '1:1');
  assert.equal(getReferenceAngleAspectRatio('avatar'), '9:16');
  assert.equal(getReferenceAngleAspectRatio('universal', 'portrait'), '9:16');
  assert.equal(getReferenceAngleAspectRatio('universal', 'landscape'), '1:1');
});
