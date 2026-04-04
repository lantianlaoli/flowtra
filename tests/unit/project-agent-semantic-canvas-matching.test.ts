import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSemanticAvatarCandidate,
  resolveSemanticNamedCandidate,
} from '@/lib/project-agent/semantic-canvas-matching';
import { matchesAssetReference } from '@/lib/project-agent/asset-name-match';

test('resolveSemanticNamedCandidate returns the uniquely matched candidate', () => {
  const result = resolveSemanticNamedCandidate({
    names: ['Health Supplements 1'],
    candidates: [
      { id: 'video-1', name: 'Health Supplements 1' },
      { id: 'video-2', name: 'Decorations 1' },
    ],
    getKey: (candidate) => candidate.id,
    getLabels: (candidate) => [candidate.name],
    matchesAssetReference,
  });

  assert.equal(result.ambiguous, false);
  assert.equal(result.match?.id, 'video-1');
});

test('resolveSemanticAvatarCandidate prefers canonical system defaults over same-name user avatars', () => {
  const result = resolveSemanticAvatarCandidate({
    names: ['Default Female'],
    userCandidates: [
      { id: 'user-avatar-1', name: 'Default Female' },
    ],
    systemCandidates: [
      { id: 'system-default-female', name: 'Default Female' },
    ],
    getKey: (candidate) => candidate.id,
    getLabels: (candidate) => [candidate.name],
    matchesAssetReference,
  });

  assert.equal(result.ambiguous, false);
  assert.equal(result.match?.id, 'system-default-female');
});

test('resolveSemanticAvatarCandidate prefers a single user avatar when the name is not a canonical system default', () => {
  const result = resolveSemanticAvatarCandidate({
    names: ['Studio Host'],
    userCandidates: [
      { id: 'user-avatar-1', name: 'Studio Host' },
    ],
    systemCandidates: [
      { id: 'system-avatar-1', name: 'Studio Host' },
    ],
    getKey: (candidate) => candidate.id,
    getLabels: (candidate) => [candidate.name],
    matchesAssetReference,
  });

  assert.equal(result.ambiguous, false);
  assert.equal(result.match?.id, 'user-avatar-1');
});

test('resolveSemanticAvatarCandidate reports ambiguity when multiple user avatars match the same request', () => {
  const result = resolveSemanticAvatarCandidate({
    names: ['Studio Host'],
    userCandidates: [
      { id: 'user-avatar-1', name: 'Studio Host' },
      { id: 'user-avatar-2', name: 'Studio Host' },
    ],
    systemCandidates: [],
    getKey: (candidate) => candidate.id,
    getLabels: (candidate) => [candidate.name],
    matchesAssetReference,
  });

  assert.equal(result.ambiguous, true);
  assert.equal(result.match, null);
});
