import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentFeatureNode,
  getMissingFeatureInputs,
  getProjectAgentCanvasNodeSize,
} from '@/lib/project-agent/canvas-state';
import { getProjectAgentFeaturePlaceholderCopy } from '@/lib/project-agent/canvas-ui';

const video = createProjectAgentAssetNode({
  type: 'video', x: 0, y: 0,
  asset: { id: 'video-1', name: 'Video', durationSeconds: 8 },
});
const text = createProjectAgentAssetNode({
  type: 'text', x: 0, y: 0,
  asset: { id: 'text-1', name: 'Instruction', content: 'Make it warmer.' },
});

test('feature nodes use the enlarged shared dimensions', () => {
  assert.deepEqual(getProjectAgentCanvasNodeSize({ type: 'video_clone' }), { width: 380, height: 300 });
  assert.deepEqual(getProjectAgentCanvasNodeSize({ type: 'avatar_ads' }), { width: 380, height: 300 });
  assert.deepEqual(getProjectAgentCanvasNodeSize({ type: 'motion_clone' }), { width: 380, height: 300 });
});

test('edit-video ready copy is mode aware', () => {
  const feature = createProjectAgentFeatureNode({ type: 'video_clone', x: 0, y: 0 });
  const state = {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    nodes: [video, text, feature],
    edges: [
      { id: createProjectAgentCanvasEdgeId(video.id, feature.id, 'video'), sourceNodeId: video.id, targetNodeId: feature.id, targetHandle: 'video' as const },
      { id: createProjectAgentCanvasEdgeId(text.id, feature.id, 'text'), sourceNodeId: text.id, targetNodeId: feature.id, targetHandle: 'text' as const },
    ],
  };
  assert.deepEqual(getMissingFeatureInputs(state, feature.id), []);
  assert.equal(getProjectAgentFeaturePlaceholderCopy({ featureType: 'video_clone', blockedReason: null, missingInputs: [], videoCloneMode: 'edit_video' }), 'Ready to edit video');
});

test('clone ready copy stays product-guidance oriented', () => {
  assert.equal(getProjectAgentFeaturePlaceholderCopy({ featureType: 'video_clone', blockedReason: null, missingInputs: [], videoCloneMode: 'clone' }), 'Ready to start. Optionally connect Product Guidance for product behavior details.');
});
