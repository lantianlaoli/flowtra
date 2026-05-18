import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentFeatureNode,
  getCanvasConnectionError,
} from '@/lib/project-agent/canvas-state';
import {
  getInstructionSemanticRole,
  getInstructionSemanticPresentation,
} from '@/lib/project-agent/instruction-semantics';

const textNode = createProjectAgentAssetNode({
  type: 'text',
  x: 0,
  y: 0,
  asset: { id: 'text-1', name: 'Instruction', content: '' },
});
const videoNode = createProjectAgentAssetNode({
  type: 'video',
  x: 0,
  y: 0,
  asset: { id: 'video-1', name: 'Video', durationSeconds: 8 },
});
const productNode = createProjectAgentAssetNode({
  type: 'product',
  x: 0,
  y: 0,
  asset: { id: 'product-1', name: 'Product' },
});
const avatarNode = createProjectAgentAssetNode({
  type: 'avatar',
  x: 0,
  y: 0,
  asset: { id: 'avatar-1', name: 'Avatar' },
});

test('unconnected text nodes render as generic instructions', () => {
  const state = { ...DEFAULT_PROJECT_AGENT_CANVAS_STATE, nodes: [textNode] };
  assert.equal(getInstructionSemanticRole(state, textNode.id), 'instruction');
  assert.deepEqual(getInstructionSemanticPresentation('instruction'), {
    label: 'Instruction',
    placeholder: 'Write an instruction...',
  });
});

test('avatar ads text inputs render as scripts', () => {
  const feature = createProjectAgentFeatureNode({ type: 'avatar_ads', x: 0, y: 0 });
  const state = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [textNode, avatarNode, feature],
    edges: [{
      id: createProjectAgentCanvasEdgeId(textNode.id, feature.id, 'text'),
      sourceNodeId: textNode.id,
      targetNodeId: feature.id,
      targetHandle: 'text' as const,
    }],
  };
  assert.equal(getInstructionSemanticRole(state, textNode.id), 'script');
  assert.equal(getInstructionSemanticPresentation('script').label, 'Script');
});

test('video clone text inputs adapt between edit instructions and product guidance', () => {
  const feature = createProjectAgentFeatureNode({ type: 'video_clone', x: 0, y: 0 });
  const baseEdges = [
    {
      id: createProjectAgentCanvasEdgeId(videoNode.id, feature.id, 'video'),
      sourceNodeId: videoNode.id,
      targetNodeId: feature.id,
      targetHandle: 'video' as const,
    },
    {
      id: createProjectAgentCanvasEdgeId(textNode.id, feature.id, 'text'),
      sourceNodeId: textNode.id,
      targetNodeId: feature.id,
      targetHandle: 'text' as const,
    },
  ];
  const editState = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [textNode, videoNode, feature],
    edges: baseEdges,
  };
  assert.equal(getInstructionSemanticRole(editState, textNode.id), 'edit_instruction');

  const guidanceState = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [textNode, videoNode, productNode, feature],
    edges: [
      ...baseEdges,
      {
        id: createProjectAgentCanvasEdgeId(productNode.id, feature.id, 'product'),
        sourceNodeId: productNode.id,
        targetNodeId: feature.id,
        targetHandle: 'product' as const,
      },
    ],
  };
  assert.equal(getInstructionSemanticRole(guidanceState, textNode.id), 'product_guidance');
  assert.equal(getInstructionSemanticPresentation('product_guidance').label, 'Product Guidance');
});

test('text nodes cannot be reused across conflicting semantic roles', () => {
  const avatarAds = createProjectAgentFeatureNode({ type: 'avatar_ads', x: 0, y: 0 });
  const clone = createProjectAgentFeatureNode({ type: 'video_clone', x: 0, y: 0 });
  const state = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [textNode, videoNode, avatarAds, clone],
    edges: [
      {
        id: createProjectAgentCanvasEdgeId(textNode.id, avatarAds.id, 'text'),
        sourceNodeId: textNode.id,
        targetNodeId: avatarAds.id,
        targetHandle: 'text' as const,
      },
      {
        id: createProjectAgentCanvasEdgeId(videoNode.id, clone.id, 'video'),
        sourceNodeId: videoNode.id,
        targetNodeId: clone.id,
        targetHandle: 'video' as const,
      },
    ],
  };
  const edge = {
    id: createProjectAgentCanvasEdgeId(textNode.id, clone.id, 'text'),
    sourceNodeId: textNode.id,
    targetNodeId: clone.id,
    targetHandle: 'text' as const,
  };
  assert.equal(
    getCanvasConnectionError(state, edge),
    'This instruction is already used as a Script. Create a new instruction for Edit Instruction.'
  );
});
