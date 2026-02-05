import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAvatarPhotoSet,
  addAvatarReferencePhoto,
  deleteAvatarReferencePhotoByIndex,
  promoteAvatarReferenceToPrimary
} from '../../lib/supabase'

test('create avatar photo set initializes primary and empty references', () => {
  const photoSet = createAvatarPhotoSet('https://example.com/primary.jpg', 'primary.jpg')

  assert.equal(photoSet.primary.photo_url, 'https://example.com/primary.jpg')
  assert.equal(photoSet.primary.file_name, 'primary.jpg')
  assert.deepEqual(photoSet.references, [])
})

test('add reference photo keeps max three references', () => {
  const initial = createAvatarPhotoSet('https://example.com/primary.jpg', 'primary.jpg', [
    { photo_url: 'https://example.com/ref1.jpg', file_name: 'ref1.jpg', tag: 'angle_45' },
    { photo_url: 'https://example.com/ref2.jpg', file_name: 'ref2.jpg', tag: 'profile_or_detail' },
    { photo_url: 'https://example.com/ref3.jpg', file_name: 'ref3.jpg', tag: 'custom' }
  ])

  const next = addAvatarReferencePhoto(initial, {
    photo_url: 'https://example.com/ref4.jpg',
    file_name: 'ref4.jpg',
    tag: 'custom'
  })

  assert.equal(next.references.length, 3)
  assert.equal(next.references[2].photo_url, 'https://example.com/ref3.jpg')
})

test('delete reference removes only selected item', () => {
  const initial = createAvatarPhotoSet('https://example.com/primary.jpg', 'primary.jpg', [
    { photo_url: 'https://example.com/ref1.jpg', file_name: 'ref1.jpg', tag: 'angle_45' },
    { photo_url: 'https://example.com/ref2.jpg', file_name: 'ref2.jpg', tag: 'custom' }
  ])

  const next = deleteAvatarReferencePhotoByIndex(initial, 0)

  assert.equal(next.references.length, 1)
  assert.equal(next.references[0].photo_url, 'https://example.com/ref2.jpg')
})

test('promote reference to primary swaps primary and selected reference', () => {
  const initial = createAvatarPhotoSet('https://example.com/primary.jpg', 'primary.jpg', [
    { photo_url: 'https://example.com/ref1.jpg', file_name: 'ref1.jpg', tag: 'angle_45' },
    { photo_url: 'https://example.com/ref2.jpg', file_name: 'ref2.jpg', tag: 'custom' }
  ])

  const next = promoteAvatarReferenceToPrimary(initial, 1)

  assert.equal(next.primary.photo_url, 'https://example.com/ref2.jpg')
  assert.equal(next.references.length, 2)
  assert.ok(next.references.some((item) => item.photo_url === 'https://example.com/primary.jpg'))
})
