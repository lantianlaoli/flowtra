import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeOriginalAvatarReferences,
  removeOriginalProductReferences
} from '@/lib/project-agent/clone-product-replacement';

test('product replacement removes original reference product from shot fields', () => {
  const cleaned = removeOriginalProductReferences({
    text: 'Presenter holds up three different colored Goli gummy bottles close to the camera while speaking.',
    productName: 'Collagen Peptides Jar',
    productToken: '@product(Collagen Peptides Jar)'
  });

  assert.equal(
    cleaned,
    'Presenter holds up @product(Collagen Peptides Jar) close to the camera while speaking.'
  );
  assert.doesNotMatch(cleaned, /goli|gummy|three different colored bottles/i);
});

test('product replacement preserves generic motion without duplicating selected product token', () => {
  const cleaned = removeOriginalProductReferences({
    text: '@product(Collagen Peptides Jar) is held in a horizontal row across the frame.',
    productName: 'Collagen Peptides Jar',
    productToken: '@product(Collagen Peptides Jar)'
  });

  assert.equal(cleaned, '@product(Collagen Peptides Jar) is held in a horizontal row across the frame.');
});

test('product replacement falls back to product name when mention token is unavailable', () => {
  const cleaned = removeOriginalProductReferences({
    text: 'Subject: African American man and Goli gummy bottles.',
    productName: 'Collagen Peptides Jar'
  });

  assert.equal(cleaned, 'Subject: African American man and Collagen Peptides Jar.');
});

test('avatar replacement removes original reference performer from prompt text', () => {
  const cleaned = removeOriginalAvatarReferences({
    text: 'The shot opens on a medium close-up of an African American man centered in the frame.',
    avatarName: 'Veronica'
  });

  assert.equal(cleaned, 'The shot opens on a medium close-up of Veronica centered in the frame.');
  assert.doesNotMatch(cleaned, /African American man|\bman\b/i);
});
