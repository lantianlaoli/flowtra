import test from 'node:test';
import assert from 'node:assert/strict';

import { MY_ADS_RETENTION_DAYS, isMyAdExpired } from '@/lib/my-ads-retention';

test('my ads stay available before the 14 day retention window ends', () => {
  const now = new Date('2026-03-17T12:00:00.000Z');
  const createdAt = new Date(now.getTime() - ((MY_ADS_RETENTION_DAYS * 24 * 60 * 60 * 1000) - 1000));

  assert.equal(isMyAdExpired(createdAt, now), false);
});

test('my ads expire exactly at the 14 day retention boundary', () => {
  const now = new Date('2026-03-17T12:00:00.000Z');
  const createdAt = new Date(now.getTime() - (MY_ADS_RETENTION_DAYS * 24 * 60 * 60 * 1000));

  assert.equal(isMyAdExpired(createdAt, now), true);
});

test('invalid dates are treated as active to avoid blocking access accidentally', () => {
  assert.equal(isMyAdExpired('not-a-date', new Date('2026-03-17T12:00:00.000Z')), false);
});
