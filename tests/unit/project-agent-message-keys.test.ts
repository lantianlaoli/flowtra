import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from '@ai-sdk/react';
import { getProjectAgentDisplayMessageKey } from '@/components/pages/ProjectAgentPage';

test('project agent display message keys stay unique when message ids repeat', () => {
  const duplicateMessages = [
    {
      id: 'duplicate-id',
      role: 'assistant',
      parts: [{ type: 'text', text: 'First assistant reply.' }],
    },
    {
      id: 'duplicate-id',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Second assistant reply.' }],
    },
    {
      id: 'duplicate-id',
      role: 'user',
      parts: [{ type: 'text', text: 'User follow-up.' }],
    },
  ] as UIMessage[];

  const keys = duplicateMessages.map((message, index) => (
    getProjectAgentDisplayMessageKey(message, index)
  ));

  assert.equal(new Set(keys).size, duplicateMessages.length);
});
