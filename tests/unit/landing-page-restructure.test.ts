import test from 'node:test';
import assert from 'node:assert/strict';

import { landingMessages } from '@/lib/i18n/landing-messages';

test('landing copy exposes the compact conversion-focused homepage sections', () => {
  assert.equal(landingMessages.en.features.title, 'How it works');
  assert.equal(landingMessages.en.whyFlowtra.title, 'Why choose Flowtra?');
  assert.equal(
    landingMessages.en.whyFlowtra.agentTitle,
    'Agent mode handles bulk execution for video clone workflows',
  );
  assert.equal(
    landingMessages.en.trialCta.title,
    'Subscribe to Lite and get a 1-day free trial',
  );
});
