import test from 'node:test';
import assert from 'node:assert/strict';

import { SYSTEM_AVATARS, getAvatarPhotoUrls } from '../../lib/default-avatars';

test('system avatars expose primary plus two reference photos', () => {
  assert.equal(SYSTEM_AVATARS.length, 4);

  SYSTEM_AVATARS.forEach((avatar) => {
    assert.equal(avatar.reference_photos.length, 3);
    assert.equal(avatar.photo_set_json.references.length, 3);
    assert.equal(avatar.primary_photo_url, avatar.photo_url);
  });
});

test('lin yuqing system avatar exposes left and back references', () => {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === 'system-default-lin');

  assert.ok(avatar);
  assert.deepEqual(
    avatar.reference_photos.map((photo) => photo.file_name),
    ['lin_yuqing_left.png', 'lin_yuqing_back.png', 'lin_yuqing_right.png'],
  );
});

test('system avatar photo count is three for kling mention validation', () => {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === 'system-default-ethan');

  assert.ok(avatar);
  assert.equal(getAvatarPhotoUrls(avatar).length, 4);
});

test('avatar photo url helper returns system avatar primary and references in stable order', () => {
  const avatar = SYSTEM_AVATARS.find((item) => item.id === 'system-default-ethan');

  assert.ok(avatar);
  assert.deepEqual(getAvatarPhotoUrls(avatar), [
    avatar.photo_url,
    `${avatar.photo_url.replace('ethan_walker.png', 'ethan_walker_left.png')}`,
    `${avatar.photo_url.replace('ethan_walker.png', 'ethan_walker_back.png')}`,
    `${avatar.photo_url.replace('ethan_walker.png', 'ethan_walker_right.png')}`,
  ]);
});
