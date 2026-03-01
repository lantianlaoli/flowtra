import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEATURE_INTEREST_OPTIONS,
  getFeatureInterestLabel,
  getFeatureInterestOption,
} from '@/lib/feature-interest';

test('ai_agent is the first feature option and marked as new', () => {
  assert.equal(FEATURE_INTEREST_OPTIONS[0]?.value, 'ai_agent');
  assert.equal(FEATURE_INTEREST_OPTIONS[0]?.isNew, true);
});

test('ai_agent resolves to the AI Agent label', () => {
  assert.equal(getFeatureInterestLabel('ai_agent'), 'AI Agent');
  assert.equal(getFeatureInterestOption('ai_agent')?.label, 'AI Agent');
});
