import test from 'node:test'
import assert from 'node:assert/strict'

import { validateProductPhotoRoleConstraints } from '../../app/api/user-products/[id]/photos/route'

test('allows uploading first frontal image', () => {
  const error = validateProductPhotoRoleConstraints([], 'frontal')
  assert.equal(error, null)
})

test('rejects duplicate frontal image', () => {
  const error = validateProductPhotoRoleConstraints(
    [{ id: '1', photo_role: 'frontal' }],
    'frontal'
  )

  assert.equal(
    error,
    'This product already has a frontal image. Delete it before uploading a new frontal image.'
  )
})

test('allows up to three reference images and rejects fourth', () => {
  const allowed = validateProductPhotoRoleConstraints(
    [
      { id: '1', photo_role: 'frontal' },
      { id: '2', photo_role: 'reference' },
      { id: '3', photo_role: 'reference' }
    ],
    'reference'
  )
  assert.equal(allowed, null)

  const rejected = validateProductPhotoRoleConstraints(
    [
      { id: '1', photo_role: 'frontal' },
      { id: '2', photo_role: 'reference' },
      { id: '3', photo_role: 'reference' },
      { id: '4', photo_role: 'reference' }
    ],
    'reference'
  )

  assert.equal(
    rejected,
    'A product can only have up to 4 photos total (1 frontal + 3 reference).'
  )
})

test('rejects any upload when total photo count reaches four', () => {
  const error = validateProductPhotoRoleConstraints(
    [
      { id: '1', photo_role: 'frontal' },
      { id: '2', photo_role: 'reference' },
      { id: '3', photo_role: 'reference' },
      { id: '4', photo_role: 'reference' }
    ],
    'frontal'
  )

  assert.equal(
    error,
    'A product can only have up to 4 photos total (1 frontal + 3 reference).'
  )
})
