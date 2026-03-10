import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveProjectAgentVideoModel,
  getProjectAgentVideoModels,
  isProjectAgentModelDisabledForIntent,
  normalizeProjectAgentVideoModel,
} from '@/lib/project-agent/video-model';

test('clone mode exposes Kling 3 as the only selectable model', () => {
  assert.deepEqual(getProjectAgentVideoModels('competitor_ugc_replication'), ['kling_3']);
  assert.equal(
    normalizeProjectAgentVideoModel('veo3_fast', 'veo3_fast', 'competitor_ugc_replication'),
    'kling_3'
  );
  assert.equal(
    normalizeProjectAgentVideoModel('seedance_1_5_pro', 'veo3_fast', 'competitor_ugc_replication'),
    'kling_3'
  );
});

test('avatar ads still force veo3_fast as the effective agent model', () => {
  assert.equal(getEffectiveProjectAgentVideoModel('avatar_ads', 'kling_3'), 'veo3_fast');
  assert.equal(isProjectAgentModelDisabledForIntent('veo3_fast', 'avatar_ads'), false);
  assert.equal(isProjectAgentModelDisabledForIntent('kling_3', 'avatar_ads'), true);
});
