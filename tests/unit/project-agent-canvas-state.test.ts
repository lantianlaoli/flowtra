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
  const textNode = createProjectAgentAssetNode({
    type: 'text',
    x: 0,
    y: 0,
    asset: { id: 'text-1', name: 'Script 1', content: 'Talk about the product benefits.' },
  });
  const featureNode = createProjectAgentFeatureNode({
    type: 'avatar_ads',
    x: 0,
    y: 0,
  });

  let state = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [avatarNode, textNode, featureNode],
  };

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['avatar', 'text']);
  assert.equal(canRunFeatureNode(state, featureNode.id), false);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(avatarNode.id, featureNode.id, 'avatar'),
    sourceNodeId: avatarNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'avatar',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['text']);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(textNode.id, featureNode.id, 'text'),
    sourceNodeId: textNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'text',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), []);
  assert.equal(canRunFeatureNode(state, featureNode.id), true);
});

test('normalizeCanvasState falls back to defaults for invalid payloads', () => {
  assert.deepEqual(normalizeCanvasState(null), DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  assert.equal(normalizeCanvasState({ chatDrawerOpen: false }).chatDrawerOpen, false);
});

test('video clone requires a reference video plus either avatar or product', () => {
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
  const videoNode = createProjectAgentAssetNode({
    type: 'video',
    x: 0,
    y: 0,
    asset: { id: 'video-1', name: 'Reference video', imageUrl: 'https://example.com/cover.png' },
  });
  const featureNode = createProjectAgentFeatureNode({
    type: 'video_clone',
    x: 0,
    y: 0,
  });

  let state = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [avatarNode, productNode, videoNode, featureNode],
  };

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['video', 'avatar', 'product']);
  assert.equal(canRunFeatureNode(state, featureNode.id), false);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(videoNode.id, featureNode.id, 'video'),
    sourceNodeId: videoNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'video',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['avatar', 'product']);
  assert.equal(canRunFeatureNode(state, featureNode.id), false);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(productNode.id, featureNode.id, 'product'),
    sourceNodeId: productNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'product',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), []);
  assert.equal(canRunFeatureNode(state, featureNode.id), true);
});
