import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectAgentSessionItems,
  getProjectAgentSessionLabel,
} from '@/lib/project-agent/workspace-ui';

test('session switcher keeps current session first and deduplicates local history', () => {
  const items = buildProjectAgentSessionItems({
    activeSessionId: 'session-current',
    historyIds: ['session-old', 'session-current', 'session-old', 'session-older'],
    sessions: [
      { sessionId: 'session-old', updatedAt: '2026-05-12T10:00:00.000Z' },
      { sessionId: 'session-current', updatedAt: '2026-05-16T10:00:00.000Z' },
      { sessionId: 'session-older', updatedAt: '2026-05-10T10:00:00.000Z' },
    ],
  });

  assert.deepEqual(items.map((item) => item.sessionId), [
    'session-current',
    'session-old',
    'session-older',
  ]);
});

test('session labels prefer explicit titles and otherwise fall back to canvas ordinal names', () => {
  assert.equal(getProjectAgentSessionLabel({ title: 'Launch Concepts', index: 2 }), 'Launch Concepts');
  assert.equal(getProjectAgentSessionLabel({ title: '', index: 2 }), 'Canvas 3');
});
