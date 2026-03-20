import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMentionToken, buildTypedMentionToken, parseMentionToken } from '@/lib/prompt-mention-tokens';

test('buildMentionToken returns wrapped @(Label) syntax for new prompt text', () => {
  assert.equal(buildMentionToken({ type: 'character', label: 'Default Male' }), '@(Default Male)');
  assert.equal(buildMentionToken({ type: 'product', label: 'Diet-1' }), '@(Diet-1)');
});

test('buildTypedMentionToken now aliases the wrapped @(Label) syntax used by agent drafts', () => {
  assert.equal(buildTypedMentionToken({ type: 'character', label: 'Default Male' }), '@(Default Male)');
  assert.equal(buildTypedMentionToken({ type: 'product', label: 'Diet-1' }), '@(Diet-1)');
});

test('buildTypedMentionToken strips unsupported parentheses but preserves readable labels', () => {
  assert.equal(buildTypedMentionToken({ type: 'product', label: 'Glow Serum (New)' }), '@(Glow Serum New)');
});

test('parseMentionToken supports the new wrapped syntax while keeping legacy typed tokens readable', () => {
  assert.deepEqual(parseMentionToken('@(Default Male)'), {
    type: 'unknown',
    label: 'Default Male',
    key: 'default_male',
    syntax: 'wrapped'
  });

  assert.deepEqual(parseMentionToken('@character(Default Male)'), {
    type: 'character',
    label: 'Default Male',
    key: 'default_male',
    syntax: 'typed'
  });
});
