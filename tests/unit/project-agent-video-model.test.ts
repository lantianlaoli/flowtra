import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveProjectAgentVideoModel,
  getProjectAgentVideoModels,
  isProjectAgentModelDisabledForIntent,
  normalizeProjectAgentVideoModel,
} from '@/lib/project-agent/video-model';

test('project agent exposes Kling 3 as the only selectable model', () => {
  assert.deepEqual(getProjectAgentVideoModels(), ['kling_3']);
  assert.deepEqual(getProjectAgentVideoModels('video_clone'), ['kling_3']);
  assert.equal(
    normalizeProjectAgentVideoModel('veo3_fast', 'veo3_fast', 'video_clone'),
    'kling_3'
  );
  assert.equal(
    normalizeProjectAgentVideoModel('seedance_1_5_pro', 'veo3_fast', 'video_clone'),
    'kling_3'
  );
  assert.equal(
    normalizeProjectAgentVideoModel('veo3_fast', 'veo3_fast'),
    'kling_3'
  );
});

test('avatar ads keep kling_3 as the fixed effective agent model', () => {
  assert.equal(getEffectiveProjectAgentVideoModel('avatar_ads', 'kling_3'), 'kling_3');
  assert.equal(isProjectAgentModelDisabledForIntent('veo3_fast', 'avatar_ads'), true);
  assert.equal(isProjectAgentModelDisabledForIntent('kling_3', 'avatar_ads'), false);
});

test('motion clone keeps kling_3 as the effective agent model', () => {
  assert.equal(getEffectiveProjectAgentVideoModel('motion_clone', 'kling_3'), 'kling_3');
  assert.equal(isProjectAgentModelDisabledForIntent('kling_3', 'motion_clone'), false);
});
