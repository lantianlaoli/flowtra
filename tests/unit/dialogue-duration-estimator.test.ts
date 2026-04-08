import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';

test('English estimator adds overhead for currency and decimals', () => {
  const plain = estimateDialogueDuration('These boxing mitts feel great and hold up well in training.', 'en');
  const priced = estimateDialogueDuration('These boxing mitts cost only $25.99 and use 1.5-inch padding.', 'en');

  assert.equal(priced > plain, true);
});

test('English estimator adds overhead for dash-separated clauses', () => {
  const plain = estimateDialogueDuration('These mitts feel like a steal for beginners.', 'en');
  const dashed = estimateDialogueDuration('These mitts feel like a steal — honestly such a steal for beginners.', 'en');

  assert.equal(dashed > plain, true);
});

test('English estimator adds overhead for comma-heavy product copy', () => {
  const plain = estimateDialogueDuration('Perfect for boxing and home workouts.', 'en');
  const commaHeavy = estimateDialogueDuration('Perfect for boxing, kickboxing, cardio drills, and even home workouts.', 'en');

  assert.equal(commaHeavy > plain, true);
});
