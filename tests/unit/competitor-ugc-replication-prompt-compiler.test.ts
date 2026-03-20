import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePromptForExecution, replaceMentionsForPlainText } from '@/lib/competitor-ugc-replication-prompt-compiler';

test('kling mode preserves @mentions for mapping path', () => {
  const source = {
    first_frame_description: '@(Default Male) holds @(book) in frame.',
    shots: [
      {
        subject: '@(Default Male)',
        action: 'reading @(book)'
      }
    ]
  };

  const result = compilePromptForExecution(source, 'kling_3');
  assert.equal(result.compileMode, 'kling_elements');
  assert.equal(result.mentionCount, 4);
  assert.equal(result.compiledValue.shots[0].subject, '@(Default Male)');
});

test('veo/seedance mode compiles mentions to plain text recursively', () => {
  const source = {
    first_frame_description: '@(Default Male) holds @(book) in frame.',
    subject: 'A @(Default Male) looking at camera.',
    action: 'holding @(book).',
    shots: [
      {
        subject: '@(Default Male)',
        action: 'reading @(book)',
        dialogue: 'Talk about @(book)',
        audio: 'music'
      }
    ]
  };

  const result = compilePromptForExecution(source, 'veo3_fast');
  assert.equal(result.compileMode, 'plain_text');
  assert.equal(result.mentionCount, 7);
  assert.equal(result.compiledValue.first_frame_description, 'Default Male holds book in frame.');
  assert.equal(result.compiledValue.shots[0].subject, 'Default Male');
  assert.equal(result.compiledValue.shots[0].action, 'reading book');
  assert.equal(result.compiledValue.shots[0].dialogue, 'Talk about book');
});

test('plain text prompt stays unchanged in non-kling compile', () => {
  const source = {
    first_frame_description: 'A man smiles while holding a product in warm sunlight.'
  };
  const result = compilePromptForExecution(source, 'seedance_1_5_pro');

  assert.equal(result.mentionCount, 0);
  assert.equal(result.compiledValue.first_frame_description, source.first_frame_description);
});

test('unknown mention gracefully degrades to display name text', () => {
  const converted = replaceMentionsForPlainText('A close shot of @(Unknown Hero) using @(New Item).');
  assert.equal(converted, 'A close shot of Unknown Hero using New Item.');
});
