import test from 'node:test';
import assert from 'node:assert/strict';
import { getGenerationCost } from '@/lib/constants';

test('seedance fast pricing distinguishes resolution and video input', () => {
  assert.equal(getGenerationCost('seedance_2_fast', '10', '480p', { hasVideoInput: false }), 155);
  assert.equal(getGenerationCost('seedance_2_fast', '10', '720p', { hasVideoInput: false }), 330);
  assert.equal(getGenerationCost('seedance_2_fast', '10', '480p', { hasVideoInput: true }), 90);
  assert.equal(getGenerationCost('seedance_2_fast', '10', '720p', { hasVideoInput: true }), 200);
});

test('seedance 2 pricing distinguishes resolution and video input', () => {
  assert.equal(getGenerationCost('seedance_2', '10', '480p', { hasVideoInput: false }), 190);
  assert.equal(getGenerationCost('seedance_2', '10', '720p', { hasVideoInput: false }), 410);
  assert.equal(getGenerationCost('seedance_2', '10', '1080p', { hasVideoInput: false }), 1020);
  assert.equal(getGenerationCost('seedance_2', '10', '480p', { hasVideoInput: true }), 115);
  assert.equal(getGenerationCost('seedance_2', '10', '720p', { hasVideoInput: true }), 250);
  assert.equal(getGenerationCost('seedance_2', '10', '1080p', { hasVideoInput: true }), 620);
});
