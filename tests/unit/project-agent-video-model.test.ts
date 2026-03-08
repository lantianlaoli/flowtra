import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveProjectAgentVideoModel,
  normalizeProjectAgentVideoModel
} from '@/lib/project-agent/video-model';

test('normalizeProjectAgentVideoModel accepts all supported agent models', () => {
  assert.equal(normalizeProjectAgentVideoModel('veo3_fast'), 'veo3_fast');
  assert.equal(normalizeProjectAgentVideoModel('veo3'), 'veo3');
  assert.equal(normalizeProjectAgentVideoModel('seedance_1_5_pro'), 'seedance_1_5_pro');
  assert.equal(normalizeProjectAgentVideoModel('kling_3'), 'kling_3');
});

test('normalizeProjectAgentVideoModel falls back to veo3_fast for invalid values', () => {
  assert.equal(normalizeProjectAgentVideoModel('unknown_model'), 'veo3_fast');
  assert.equal(normalizeProjectAgentVideoModel(undefined), 'veo3_fast');
});

test('avatar ads flow forces the effective model to veo3_fast', () => {
  assert.equal(getEffectiveProjectAgentVideoModel('avatar_ads', 'kling_3'), 'veo3_fast');
  assert.equal(getEffectiveProjectAgentVideoModel('avatar_ads', 'veo3'), 'veo3_fast');
});

test('non-avatar flows keep the selected supported model', () => {
  assert.equal(getEffectiveProjectAgentVideoModel('competitor_ugc_replication', 'kling_3'), 'kling_3');
  assert.equal(getEffectiveProjectAgentVideoModel('motion_swap', 'seedance_1_5_pro'), 'seedance_1_5_pro');
});
