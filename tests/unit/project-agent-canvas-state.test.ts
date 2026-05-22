import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  buildProjectAgentOutputFeedbackPayload,
  canRunFeatureNode,
  connectCanvasNodes,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentFeatureNode,
  createProjectAgentOutputVideoNode,
  getProjectAgentCanvasNodeSize,
  getProjectAgentCanvasTargetHandlePosition,
  getProjectAgentFeedbackProjectType,
  getMissingFeatureInputs,
  isProjectAgentRuntimeActive,
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

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['video', 'avatar', 'product', 'text']);
  assert.equal(canRunFeatureNode(state, featureNode.id), false);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(videoNode.id, featureNode.id, 'video'),
    sourceNodeId: videoNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'video',
  });
  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), ['avatar', 'product', 'text']);
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

test('feature target handle position tracks the rendered feature node size', () => {
  const featureNode = createProjectAgentFeatureNode({
    type: 'video_clone',
    x: 360,
    y: 80,
  });
  const size = getProjectAgentCanvasNodeSize(featureNode);

  assert.deepEqual(size, { width: 380, height: 300 });
  assert.deepEqual(getProjectAgentCanvasTargetHandlePosition(featureNode), {
    x: 360,
    y: 80 + size.height / 2,
  });
});

test('video clone accepts an optional text node without changing required inputs', () => {
  const productNode = createProjectAgentAssetNode({
    type: 'product',
    x: 0,
    y: 0,
    asset: { id: 'product-1', name: 'Product 1', imageUrl: 'https://example.com/product.png' },
  });
  const textNode = createProjectAgentAssetNode({
    type: 'text',
    x: 0,
    y: 0,
    asset: { id: 'text-1', name: 'Text', content: 'Bubbles come out from the front outlet.' },
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
    nodes: [productNode, textNode, videoNode, featureNode],
  };

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(videoNode.id, featureNode.id, 'video'),
    sourceNodeId: videoNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'video',
  });
  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(productNode.id, featureNode.id, 'product'),
    sourceNodeId: productNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'product',
  });

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), []);
  assert.equal(canRunFeatureNode(state, featureNode.id), true);

  state = connectCanvasNodes(state, {
    id: createProjectAgentCanvasEdgeId(textNode.id, featureNode.id, 'text'),
    sourceNodeId: textNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'text',
  });

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), []);
  assert.equal(canRunFeatureNode(state, featureNode.id), true);
});

test('runtime with active milestones stays active even if executionState drifted from running', () => {
  assert.equal(isProjectAgentRuntimeActive({
    executionState: 'ready',
    phase: 'awaiting_review',
    milestones: [
      { key: 'preparing_prompt', label: 'Preparing prompt', state: 'completed' },
      { key: 'generating_cover', label: 'Generating cover', state: 'active' },
      { key: 'generating_video', label: 'Generating video', state: 'pending' },
      { key: 'completed', label: 'Completed', state: 'pending' },
    ],
  }), true);

  assert.equal(isProjectAgentRuntimeActive({
    executionState: 'ready',
    phase: 'idle',
    milestones: [
      { key: 'preparing_prompt', label: 'Preparing prompt', state: 'completed' },
      { key: 'generating_cover', label: 'Generating cover', state: 'pending' },
    ],
  }), false);
});

test('output video nodes keep project feedback metadata from their source feature node', () => {
  const featureNode = createProjectAgentFeatureNode({
    type: 'video_clone',
    x: 120,
    y: 80,
  });

  const outputNode = createProjectAgentOutputVideoNode({
    sourceNode: featureNode,
    projectId: 'project-123',
    outputUrl: 'https://example.com/result.mp4',
    previewUrl: null,
    linkedOutputCount: 0,
  });

  assert.equal(outputNode.type, 'output_video');
  assert.equal(outputNode.asset?.id, featureNode.id);
  assert.equal(outputNode.asset?.projectId, 'project-123');
  assert.equal(outputNode.asset?.projectType, 'video-clone');
  assert.equal(outputNode.asset?.videoUrl, 'https://example.com/result.mp4');
});

test('project agent feedback project type matches feedback API values', () => {
  assert.equal(getProjectAgentFeedbackProjectType('avatar_ads'), 'avatar-ads');
  assert.equal(getProjectAgentFeedbackProjectType('video_clone'), 'video-clone');
  assert.equal(getProjectAgentFeedbackProjectType('motion_clone'), 'motion-clone');
});

test('output feedback payload requires project metadata and feedback type', () => {
  assert.deepEqual(
    buildProjectAgentOutputFeedbackPayload({
      id: 'feature-1',
      name: 'Output',
      projectId: 'project-123',
      projectType: 'motion-clone',
      videoUrl: 'https://example.com/result.mp4',
    }, 'negative'),
    {
      projectId: 'project-123',
      projectType: 'motion-clone',
      feedbackType: 'negative',
    }
  );

  assert.equal(
    buildProjectAgentOutputFeedbackPayload({
      id: 'feature-1',
      name: 'Output',
      videoUrl: 'https://example.com/result.mp4',
    }, 'positive'),
    null
  );
});
