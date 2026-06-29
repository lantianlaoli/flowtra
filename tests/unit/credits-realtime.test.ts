import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CREDIT_BALANCE_REALTIME_EVENTS,
  readCreditsRealtimeBalance,
} from '@/lib/credits-realtime';

test('credit balance realtime display listens to inserts and updates only', () => {
  assert.deepEqual(CREDIT_BALANCE_REALTIME_EVENTS, ['INSERT', 'UPDATE']);
});

test('credit balance realtime payload reads credits_remaining without polling', () => {
  assert.equal(readCreditsRealtimeBalance({ credits_remaining: 1707 }), 1707);
  assert.equal(readCreditsRealtimeBalance({ credits_remaining: '1707' }), undefined);
  assert.equal(readCreditsRealtimeBalance({}), undefined);
});
