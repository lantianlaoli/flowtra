import test from 'node:test';
import assert from 'node:assert/strict';

import { isTransientSupabaseError, runSupabaseQueryWithRetry } from '@/lib/supabase-retry';

test('isTransientSupabaseError detects fetch-level transport failures from Supabase', () => {
  assert.equal(
    isTransientSupabaseError({
      message: 'TypeError: fetch failed',
      details: 'Client network socket disconnected before secure TLS connection was established (ECONNRESET)'
    }),
    true
  );

  assert.equal(
    isTransientSupabaseError({
      message: 'relation "project_agent_sessions" does not exist',
      details: ''
    }),
    false
  );
});

test('runSupabaseQueryWithRetry retries transient result errors and returns the successful attempt', async () => {
  let attempts = 0;

  const result = await runSupabaseQueryWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      return {
        data: null,
        error: {
          message: 'TypeError: fetch failed',
          details: 'ECONNRESET'
        }
      };
    }

    return {
      data: { ok: true },
      error: null
    };
  }, {
    attempts: 3,
    baseDelayMs: 1,
    label: 'unit-test'
  });

  assert.equal(attempts, 3);
  assert.deepEqual(result.data, { ok: true });
});

test('runSupabaseQueryWithRetry does not retry non-transient result errors', async () => {
  let attempts = 0;

  const result = await runSupabaseQueryWithRetry(async () => {
    attempts += 1;
    return {
      data: null,
      error: {
        message: 'column "foo" does not exist',
        details: ''
      }
    };
  }, {
    attempts: 3,
    baseDelayMs: 1,
    label: 'unit-test'
  });

  assert.equal(attempts, 1);
  assert.equal((result.error as { message: string }).message, 'column "foo" does not exist');
});
