import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeOriginalAvatarReferences,
  removeOriginalPetReferences,
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

test('avatar replacement strips source clothing/footwear descriptors so replacement photo wins', () => {
  const cleaned = removeOriginalAvatarReferences({
    text: "The person's feet in pink sweatpants and black-and-white Nike slides visible at the bottom of the frame.",
    avatarName: 'laoli'
  });

  assert.doesNotMatch(cleaned, /pink sweatpants/i);
  assert.doesNotMatch(cleaned, /Nike/i);
  assert.doesNotMatch(cleaned, /\bslides\b/i);
  assert.match(cleaned, /laoli/);
});

test('avatar replacement strips generic gender/age descriptors that signal source identity', () => {
  const cleanedWoman = removeOriginalAvatarReferences({
    text: 'A woman walks toward the camera holding the product.',
    avatarName: 'laoli'
  });
  assert.equal(cleanedWoman, 'laoli walks toward the camera holding the product.');

  const cleanedGirl = removeOriginalAvatarReferences({
    text: 'The girl picks up the bottle from the table.',
    avatarName: 'laoli'
  });
  assert.equal(cleanedGirl, 'laoli picks up the bottle from the table.');
});

test('pet replacement substitutes pet name for source pet words', () => {
  const cleaned = removeOriginalPetReferences({
    text: "The orange tabby cat stands between the person's feet.",
    petName: 'two fat'
  });

  assert.match(cleaned, /two fat/);
  assert.doesNotMatch(cleaned, /tabby cat/);
});
