import test from 'node:test';
import assert from 'node:assert/strict';

import { getSupabaseBrowserClientCacheKey } from '@/lib/supabase/client';

test('Supabase browser client cache key is stable after Clerk auth loads', () => {
  assert.equal(getSupabaseBrowserClientCacheKey(false), 'browser-anonymous');
  assert.equal(getSupabaseBrowserClientCacheKey(true), 'browser-auth');
  assert.equal(getSupabaseBrowserClientCacheKey(true), 'browser-auth');
});
