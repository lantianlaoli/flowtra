import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CreemModerationError,
  isCreemPromptModerationEnabled,
  moderatePromptBeforeGeneration,
} from '@/lib/creem-moderation';

test('Creem prompt moderation is disabled by default', async () => {
  const previous = process.env.CREEM_PROMPT_MODERATION_ENABLED;
  delete process.env.CREEM_PROMPT_MODERATION_ENABLED;

  try {
    assert.equal(isCreemPromptModerationEnabled(), false);
    const result = await moderatePromptBeforeGeneration('', {
      externalId: 'test:disabled',
    });
    assert.deepEqual(result, { decision: 'allow' });
  } finally {
    if (previous === undefined) {
      delete process.env.CREEM_PROMPT_MODERATION_ENABLED;
    } else {
      process.env.CREEM_PROMPT_MODERATION_ENABLED = previous;
    }
  }
});

test('Creem prompt moderation only enables when env is true', async () => {
  const previous = process.env.CREEM_PROMPT_MODERATION_ENABLED;
  process.env.CREEM_PROMPT_MODERATION_ENABLED = 'true';

  try {
    assert.equal(isCreemPromptModerationEnabled(), true);
    await assert.rejects(
      () => moderatePromptBeforeGeneration('', {
        externalId: 'test:enabled',
      }),
      (error) => error instanceof CreemModerationError &&
        error.code === 'prompt_required'
    );
  } finally {
    if (previous === undefined) {
      delete process.env.CREEM_PROMPT_MODERATION_ENABLED;
    } else {
      process.env.CREEM_PROMPT_MODERATION_ENABLED = previous;
    }
  }
});
