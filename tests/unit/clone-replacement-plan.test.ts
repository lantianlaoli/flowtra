import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCartesianSceneAssignments,
  hasExplicitAvatarIntent,
  isProductOnlyIntent,
  isSelectionContinueIntent
} from '@/lib/project-agent/clone-replacement-plan';

test('detects product-only intent in EN and ZH', () => {
  assert.equal(isProductOnlyIntent('I only want to replace product'), true);
  assert.equal(isProductOnlyIntent('只换产品'), true);
  assert.equal(isProductOnlyIntent('replace avatar and product'), false);
});

test('detects explicit avatar intent', () => {
  assert.equal(hasExplicitAvatarIntent('use female avatar please'), true);
  assert.equal(hasExplicitAvatarIntent('I only need product replacement'), false);
});

test('detects selection-continue intent', () => {
  assert.equal(isSelectionContinueIntent('I have made choice'), true);
  assert.equal(isSelectionContinueIntent("I've made my choice."), true);
  assert.equal(isSelectionContinueIntent("I've already selected everything."), true);
  assert.equal(isSelectionContinueIntent('I selected already, continue'), true);
  assert.equal(isSelectionContinueIntent('next step'), true);
  assert.equal(isSelectionContinueIntent('yes, keep going'), true);
  assert.equal(isSelectionContinueIntent('go ahead'), true);
  assert.equal(isSelectionContinueIntent('Use this avatar'), true);
  assert.equal(isSelectionContinueIntent('Use this product'), true);
  assert.equal(isSelectionContinueIntent('what can you do'), false);
});

test('builds deterministic cartesian scene assignments', () => {
  const assignments = buildCartesianSceneAssignments({
    sceneCount: 5,
    avatarIds: ['a1', 'a2'],
    productIds: ['p1', 'p2']
  });

  assert.deepEqual(assignments.map((item) => [item.sceneIndex, item.avatarId, item.productId]), [
    [1, 'a1', 'p1'],
    [2, 'a1', 'p2'],
    [3, 'a2', 'p1'],
    [4, 'a2', 'p2'],
    [5, 'a1', 'p1']
  ]);
});

test('keeps avatar assignment null for product-only plans', () => {
  const assignments = buildCartesianSceneAssignments({
    sceneCount: 3,
    avatarIds: [],
    productIds: ['p1']
  });

  assert.deepEqual(assignments.map((item) => [item.sceneIndex, item.avatarId, item.productId]), [
    [1, null, 'p1'],
    [2, null, 'p1'],
    [3, null, 'p1']
  ]);
});

test('preserves valid manual scene overrides', () => {
  const assignments = buildCartesianSceneAssignments({
    sceneCount: 3,
    avatarIds: ['a1', 'a2'],
    productIds: ['p1', 'p2'],
    existingAssignments: [
      { sceneIndex: 2, avatarId: 'a2', productId: 'p2', source: 'user_override' }
    ]
  });

  assert.equal(assignments[1].avatarId, 'a2');
  assert.equal(assignments[1].productId, 'p2');
  assert.equal(assignments[1].source, 'user_override');
});
