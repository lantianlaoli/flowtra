import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProjectAgentAllowedVideoQualities,
  getEffectiveProjectAgentVideoQuality,
  canChangeProjectAgentVideoQuality,
} from '@/lib/project-agent/video-quality';

test('project agent exposes model-aware quality choices', () => {
  assert.deepEqual(getProjectAgentAllowedVideoQualities('video_clone', 'seedance_2_fast'), ['480p', '720p']);
  assert.deepEqual(getProjectAgentAllowedVideoQualities('video_clone', 'seedance_2'), ['480p', '720p', '1080p']);
  assert.deepEqual(getProjectAgentAllowedVideoQualities('video_clone', 'kling_3'), ['720p', '1080p']);
  assert.deepEqual(getProjectAgentAllowedVideoQualities('motion_clone', 'kling_3'), ['720p', '1080p']);
});

test('project agent quality normalization preserves valid choices and falls back when needed', () => {
  assert.equal(getEffectiveProjectAgentVideoQuality('video_clone', 'seedance_2', '720p'), '720p');
  assert.equal(getEffectiveProjectAgentVideoQuality('video_clone', 'seedance_2_fast', '1080p'), '720p');
  assert.equal(getEffectiveProjectAgentVideoQuality('avatar_ads', 'seedance_2_fast', '1080p'), '720p');
  assert.equal(getEffectiveProjectAgentVideoQuality('motion_clone', 'kling_3', '1080p'), '1080p');
});

test('project agent quality selector is interactive only when multiple choices exist', () => {
  assert.equal(canChangeProjectAgentVideoQuality('video_clone', 'seedance_2_fast'), true);
  assert.equal(canChangeProjectAgentVideoQuality('video_clone', 'seedance_2'), true);
  assert.equal(canChangeProjectAgentVideoQuality('motion_clone', 'kling_3'), true);
});
