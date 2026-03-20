import test from 'node:test';
import assert from 'node:assert/strict';

import { injectMentionsInline } from '@/lib/project-agent/clone-prompt-mentions';

const avatarToken = '@(Default Male)';
const productToken = '@(book)';

test('injects avatar/product mentions inline for role noun + product noun', () => {
  const prompt = 'A smiling man relaxes on a patterned floor mat in a sunlit living room, holding a book.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  assert.match(result, /A smiling @\(Default Male\)/i);
  assert.match(result, /holding a @\(book\)/i);
  assert.doesNotMatch(result, /featuring @/i);
  assert.doesNotMatch(result, /interacting with @/i);
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

  assert.match(result, /@\(Default Male\)'s stomach/i);
  assert.match(result, /read a @\(book\)/i);
  assert.doesNotMatch(result, /featuring @/i);
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

  assert.match(result, /read a @\(book\)/i);
  assert.doesNotMatch(result, /interacting with @/i);
});

test('is idempotent when prompt already contains both tokens', () => {
  const prompt = '@(Default Male) sits in frame and gently holds @(book) near the camera.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    avatarToken,
    productToken,
    avatarName: 'Default Male',
    productName: 'book'
  });

  const avatarCount = (result.match(/@\(Default Male\)/g) || []).length;
  const productCount = (result.match(/@\(book\)/g) || []).length;

  assert.equal(avatarCount, 1);
  assert.equal(productCount, 1);
  assert.doesNotMatch(result, /featuring @/i);
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

  assert.match(result, /^@\(Default Male\) is in frame,/i);
  assert.match(result, /holding @\(book\)/i);
  assert.doesNotMatch(result, /featuring @/i);
  assert.match(result, /\.$/);
});

test('keeps hands-only prompt product-only when no avatar token is provided', () => {
  const prompt = 'A close-up of hands holding the product near the sink.';
  const result = injectMentionsInline({
    imagePrompt: prompt,
    productToken,
    productName: 'book'
  });

  assert.match(result, /hands holding the @\(book\)/i);
  assert.doesNotMatch(result, /@\(Default Male\)/i);
  assert.doesNotMatch(result, /Default Founder/i);
});
