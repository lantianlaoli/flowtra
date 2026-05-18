import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GENERATION_COSTS,
  getGenerationCost,
  getSegmentDurationForModel,
  snapDurationToModel,
  VIDEO_MODEL_DISPLAY_NAMES,
  type VideoModel,
} from '@/lib/constants';
import { AVATAR_ADS_DURATION_OPTIONS } from '@/lib/avatar-ads-dialogue';
import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';
import { buildAvatarGeneratedPrompts } from '@/lib/project-agent/avatar-script-planning';

test('video model lineup only contains seedance2 and kling', () => {
  const models = Object.keys(VIDEO_MODEL_DISPLAY_NAMES).sort();
  assert.deepEqual(models, ['kling_3', 'seedance_2', 'seedance_2_fast']);
});

test('seedance2 pricing is per-second with configured costs', () => {
  assert.equal(GENERATION_COSTS.seedance_2_fast, 33);
  assert.equal(GENERATION_COSTS.seedance_2, 41);
  assert.equal(getGenerationCost('seedance_2_fast', '15'), 15 * 33);
  assert.equal(getGenerationCost('seedance_2', '15'), 15 * 41);
});

test('modern model pricing does not invent legacy 8 second defaults when duration is missing', () => {
  assert.equal(getGenerationCost('seedance_2_fast'), 0);
  assert.equal(getGenerationCost('seedance_2'), 0);
  assert.equal(getGenerationCost('kling_3'), 0);
});

test('seedance and kling segment duration is 15 seconds', () => {
  assert.equal(getSegmentDurationForModel('seedance_2_fast'), 15);
  assert.equal(getSegmentDurationForModel('seedance_2'), 15);
  assert.equal(getSegmentDurationForModel('kling_3'), 15);
});

test('avatar duration options support model-native 4-60s and include 15s', () => {
  assert.equal(AVATAR_ADS_DURATION_OPTIONS[0], 4);
  assert.equal(AVATAR_ADS_DURATION_OPTIONS[AVATAR_ADS_DURATION_OPTIONS.length - 1], 60);
  assert.ok(AVATAR_ADS_DURATION_OPTIONS.includes(15));
  assert.ok(!AVATAR_ADS_DURATION_OPTIONS.includes(3));
});

test('seedance duration snapping clamps to 4-60 range', () => {
  const model: VideoModel = 'seedance_2_fast';
  assert.equal(snapDurationToModel(model, 2), '4');
  assert.equal(snapDurationToModel(model, 15), '15');
  assert.equal(snapDurationToModel(model, 99), '60');
});

test('chinese script pricing follows planner duration and spoken-language resolution', () => {
  const script = `这款草本清风包， 精选多种天然草本配方， 温和不刺激， 轻松净化空气，

带来清新自然的气息。无论是家中卧室、客厅， 还是车内、办公空间， 都能随时使用。一放即清新， 长效留香，

让环境更舒适宜人。`;

  const resolvedLanguage = resolveAvatarSpokenLanguage({
    scriptSource: script,
    configuredLanguage: 'en',
  });
  const plannerResult = buildAvatarGeneratedPrompts({
    imagePrompt: null,
    scriptSource: script,
    language: 'en',
    model: 'seedance_2_fast',
    avatarName: 'Default Male',
    productName: 'Medicine',
  });
  const plannerTotalDuration = plannerResult.generatedPrompts.planned_total_duration_seconds;
  const plannerCredits = getGenerationCost('seedance_2_fast', String(plannerTotalDuration));

  assert.equal(resolvedLanguage, 'zh');
  assert.equal(plannerTotalDuration >= 15, true);
  assert.equal(plannerCredits, plannerTotalDuration * 33);

  const estimatedWithConfiguredEn = estimateDialogueDuration(script, 'en');
  const estimatedWithResolvedLanguage = estimateDialogueDuration(script, resolvedLanguage);
  assert.equal(Number.isFinite(estimatedWithConfiguredEn), true);
  assert.equal(Number.isFinite(estimatedWithResolvedLanguage), true);
});
