import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldCheckPlanForDashboardEntry,
  shouldRedirectDashboardEntryToSelectPlan,
} from '@/lib/dashboard-access';

test('dashboard entry does not redirect based on realtime credit balance', () => {
  assert.equal(
    shouldRedirectDashboardEntryToSelectPlan({
      isLandingUploadEntry: false,
      subscriptionStatus: 'active',
      creditsRemaining: 0,
    }),
    false
  );
});

test('landing upload entry redirects only when there is no active subscription', () => {
  assert.equal(shouldCheckPlanForDashboardEntry({ upload: 'true' }), true);
  assert.equal(shouldCheckPlanForDashboardEntry({}), false);

  assert.equal(
    shouldRedirectDashboardEntryToSelectPlan({
      isLandingUploadEntry: true,
      subscriptionStatus: null,
      creditsRemaining: 1500,
    }),
    true
  );
  assert.equal(
    shouldRedirectDashboardEntryToSelectPlan({
      isLandingUploadEntry: true,
      subscriptionStatus: 'trialing',
      creditsRemaining: 0,
    }),
    false
  );
});
