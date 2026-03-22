import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  canRunFeatureNode,
  connectCanvasNodes,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentFeatureNode,
  getMissingFeatureInputs,
  normalizeCanvasState,
} from '@/lib/project-agent/canvas-state';

test('feature nodes require their declared inputs', () => {
  const avatarNode = createProjectAgentAssetNode({
    type: 'avatar',
    x: 0,
    y: 0,
    asset: { id: 'avatar-1', name: 'Avatar 1', imageUrl: 'https://example.com/avatar.png' },
  });
  const productNode = createProjectAgentAssetNode({
    type: 'product',
    x: 0,
    y: 0,
    asset: { id: 'product-1', name: 'Product 1', imageUrl: 'https://example.com/product.png' },
  });
  const featureNode = createProjectAgentFeatureNode({
    type: 'avatar_ads',
    x: 0,
    y: 0,
  });

  let state = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [avatarNode, productNode, featureNode],
  };

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['avatar', 'product']);
  assert.equal(canRunFeatureNode(state, featureNode.id), false);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(avatarNode.id, featureNode.id, 'avatar'),
    sourceNodeId: avatarNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'avatar',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['product']);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(productNode.id, featureNode.id, 'product'),
    sourceNodeId: productNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'product',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), []);
  assert.equal(canRunFeatureNode(state, featureNode.id), true);
});

test('normalizeCanvasState falls back to defaults for invalid payloads', () => {
  assert.deepEqual(normalizeCanvasState(null), DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  assert.equal(normalizeCanvasState({ chatDrawerOpen: false }).chatDrawerOpen, false);
});
