import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_AGENT_RUNNING_MESSAGES,
  getNextProjectAgentRunningMessage,
} from '@/lib/project-agent/running-copy';

test('project agent running messages include short emotional emoji copy', () => {
  assert.ok(PROJECT_AGENT_RUNNING_MESSAGES.length >= 8);
  assert.ok(PROJECT_AGENT_RUNNING_MESSAGES.every((message) => message.length <= 28));
  assert.ok(PROJECT_AGENT_RUNNING_MESSAGES.some((message) => /[\u{1F300}-\u{1FAFF}]/u.test(message)));
});

test('project agent running message picker avoids repeating current message when possible', () => {
  const current = PROJECT_AGENT_RUNNING_MESSAGES[0];
  const next = getNextProjectAgentRunningMessage(current, () => 0);

  assert.notEqual(next, current);
  assert.ok(PROJECT_AGENT_RUNNING_MESSAGES.includes(next));
});
