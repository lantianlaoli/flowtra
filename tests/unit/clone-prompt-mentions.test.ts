import test from 'node:test';
import assert from 'node:assert/strict';

import { injectMentionsInline } from '@/lib/project-agent/clone-prompt-mentions';

const avatarToken = '@character(Default Male)';
const productToken = '@product(book)';

test('injects avatar/product mentions inline for role noun + product noun', () => {
  const prompt = 'A smiling man relaxes on a patterned floor mat in a sunlit living room, holding a book.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  assert.match(result, /A smiling @character\(Default Male\)/i);
  assert.match(result, /holding a @product\(book\)/i);
  assert.doesNotMatch(result, /featuring @character\(/i);
  assert.doesNotMatch(result, /interacting with @product\(/i);
});

test('replaces pronoun when no role noun exists', () => {
  const prompt = 'Lying on his stomach in a home playroom with soft flooring, props himself up to carefully read a book.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  assert.match(result, /@character\(Default Male\)'s stomach/i);
  assert.match(result, /read a @product\(book\)/i);
  assert.doesNotMatch(result, /featuring @character\(/i);
});

test('repairs broken placeholder like "a ," without suffix boilerplate', () => {
  const prompt = 'Lying on his stomach, he tries to read a , in a home playroom.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  assert.match(result, /read a @product\(book\)/i);
  assert.doesNotMatch(result, /interacting with @product\(/i);
});

test('is idempotent when prompt already contains both tokens', () => {
  const prompt = '@character(Default Male) sits in frame and gently holds @product(book) near the camera.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  const avatarCount = (result.match(/@character\(Default Male\)/g) || []).length;
  const productCount = (result.match(/@product\(book\)/g) || []).length;

  assert.equal(avatarCount, 1);
  assert.equal(productCount, 1);
  assert.doesNotMatch(result, /featuring @character\(/i);
});

test('falls back to inline anchor when no obvious noun exists', () => {
  const prompt = 'In a cozy room with warm window light and shallow depth of field.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  assert.match(result, /^@character\(Default Male\) is in frame,/i);
  assert.match(result, /holding @product\(book\)/i);
  assert.doesNotMatch(result, /featuring @character\(/i);
  assert.match(result, /\.$/);
});
