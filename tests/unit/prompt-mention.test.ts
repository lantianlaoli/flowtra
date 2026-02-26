import test from 'node:test';
import assert from 'node:assert/strict';

import { getActiveMentionQuery } from '@/lib/prompt-mention';

test('returns active mention query while typing @query', () => {
  const text = 'A close shot of @pro';
  const result = getActiveMentionQuery(text, text.length);

  assert.deepEqual(result, { start: 16, query: 'pro' });
});

test('does not activate mention after complete token', () => {
  const text = 'A close shot of @product(book)';
  const result = getActiveMentionQuery(text, text.length);

  assert.equal(result, null);
});

test('does not activate mention in the middle of a word', () => {
  const text = 'email@domain';
  const result = getActiveMentionQuery(text, text.length);

  assert.equal(result, null);
});
