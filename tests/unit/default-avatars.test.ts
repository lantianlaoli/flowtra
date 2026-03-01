import test from 'node:test';
import assert from 'node:assert/strict';

import { SYSTEM_AVATARS, getAvatarPhotoUrls } from '../../lib/default-avatars';

test('system avatars expose primary plus two reference photos', () => {
  assert.equal(SYSTEM_AVATARS.length, 3);

  SYSTEM_AVATARS.forEach((avatar) => {
    assert.equal(avatar.reference_photos.length, 2);
    assert.equal(avatar.photo_set_json.references.length, 2);
    assert.equal(avatar.primary_photo_url, avatar.photo_url);
  });
});

test('default female system avatar exposes left and back references', () => {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === 'system-default-female');

  assert.ok(avatar);
  assert.deepEqual(
    avatar.reference_photos.map((photo) => photo.file_name),
    ['user_default_female_left.png', 'user_default_female_back.png'],
  );
});

test('system avatar photo count is three for kling mention validation', () => {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === 'system-default-male');

  assert.ok(avatar);
  assert.equal(getAvatarPhotoUrls(avatar).length, 3);
});

test('avatar photo url helper returns system avatar primary and references in stable order', () => {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === 'system-default-founder');

  assert.ok(avatar);
  assert.deepEqual(getAvatarPhotoUrls(avatar), [
    avatar.photo_url,
    `${avatar.photo_url.replace('user_default_founder.png', 'user_default_founder_left.png')}`,
    `${avatar.photo_url.replace('user_default_founder.png', 'user_default_founder_back.png')}`,
  ]);
});
