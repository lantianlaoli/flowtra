import test from 'node:test';
import assert from 'node:assert/strict';

import { hasVisibleAssistantReplyAfterLatestUserTurn } from '@/components/pages/ProjectAgentPage';

type TestMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
};

const textMessage = (id: string, role: 'user' | 'assistant', text: string): TestMessage => ({
  id,
  role,
  parts: [{ type: 'text', text }],
});

test('streaming placeholder stays visible when latest user turn has no assistant text yet', () => {
  const messages = [
    textMessage('u1', 'user', 'I selected "Uploaded" as the reference video for clone.'),
  ];

  assert.equal(hasVisibleAssistantReplyAfterLatestUserTurn(messages as never), false);
});

test('streaming placeholder hides once latest user turn has partial assistant text', () => {
  const messages = [
    textMessage('u1', 'user', 'I selected "Uploaded" as the reference video for clone.'),
    textMessage('a1', 'assistant', 'Got it, I have locked in your uploaded reference video.'),
  ];

  assert.equal(hasVisibleAssistantReplyAfterLatestUserTurn(messages as never), true);
});

test('empty assistant chunks do not suppress the placeholder', () => {
  const messages = [
    textMessage('u1', 'user', 'Show me reference videos.'),
    textMessage('a1', 'assistant', '   '),
  ];

  assert.equal(hasVisibleAssistantReplyAfterLatestUserTurn(messages as never), false);
});

test('only assistant replies after the latest user turn suppress the placeholder', () => {
  const messages = [
    textMessage('u1', 'user', 'First question'),
    textMessage('a1', 'assistant', 'First answer'),
    textMessage('u2', 'user', 'Second question'),
  ];

  assert.equal(hasVisibleAssistantReplyAfterLatestUserTurn(messages as never), false);
});
