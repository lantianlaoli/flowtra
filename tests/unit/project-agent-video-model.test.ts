import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveProjectAgentVideoModel,
  getProjectAgentVideoModels,
  isProjectAgentModelDisabledForIntent,
  normalizeProjectAgentVideoModel,
} from '@/lib/project-agent/video-model';

test('project agent exposes clone and edit-video model sets separately', () => {
  assert.deepEqual(getProjectAgentVideoModels(), ['kling_3']);
  assert.deepEqual(getProjectAgentVideoModels('video_clone'), ['seedance_2', 'seedance_2_fast', 'kling_3']);
  assert.deepEqual(getProjectAgentVideoModels('video_clone', 'edit_video'), ['seedance_2', 'seedance_2_fast']);
  assert.equal(
    normalizeProjectAgentVideoModel('seedance_2_fast', 'seedance_2_fast', 'video_clone'),
    'seedance_2_fast'
  );
  assert.equal(
    normalizeProjectAgentVideoModel('seedance_2', 'seedance_2_fast', 'video_clone'),
    'seedance_2'
  );
  assert.equal(
    normalizeProjectAgentVideoModel('seedance_2_fast', 'seedance_2_fast'),
    'kling_3'
  );
  assert.equal(
    normalizeProjectAgentVideoModel('kling_3', 'seedance_2', 'video_clone', 'edit_video'),
    'seedance_2'
  );
});

test('avatar ads expose the full supported agent model set', () => {
  assert.deepEqual(
    getProjectAgentVideoModels('avatar_ads'),
    ['seedance_2_fast', 'seedance_2', 'kling_3']
  );
  assert.equal(getEffectiveProjectAgentVideoModel('avatar_ads', undefined), 'seedance_2_fast');
  assert.equal(getEffectiveProjectAgentVideoModel('avatar_ads', 'seedance_2'), 'seedance_2');
  assert.equal(isProjectAgentModelDisabledForIntent('seedance_2_fast', 'avatar_ads'), false);
  assert.equal(isProjectAgentModelDisabledForIntent('kling_3', 'avatar_ads'), false);
});

test('motion clone keeps kling_3 as the effective agent model', () => {
  assert.equal(getEffectiveProjectAgentVideoModel('motion_clone', 'kling_3'), 'kling_3');
  assert.equal(isProjectAgentModelDisabledForIntent('kling_3', 'motion_clone'), false);
});
