import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProjectAgentVideoCloneMode,
  getProjectAgentVideoCloneDurationSeconds,
  getProjectAgentVideoCloneAllowedModels,
} from '@/lib/project-agent/video-clone-mode';
import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  createProjectAgentAssetNode,
  createProjectAgentFeatureNode,
  getMissingFeatureInputs,
  getFeatureStartBlockedReason,
  type ProjectAgentAssetNodeType,
} from '@/lib/project-agent/canvas-state';
import { buildVideoCloneStartPayload } from '@/lib/project-agent/node-execution';

const video = { id: 'video-1', name: 'Video', durationSeconds: 9, videoUrl: 'https://example.com/source.mp4' };
const text = { id: 'text-1', name: 'Prompt', content: 'Add a soft cinematic glow.' };
const avatar = { id: 'avatar-1', name: 'Avatar' };

function buildState(assetNodes: ReturnType<typeof createProjectAgentAssetNode>[]) {
  const feature = createProjectAgentFeatureNode({ type: 'video_clone', x: 0, y: 0 });
  return {
    feature,
    state: {
      ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
      nodes: [...assetNodes, feature],
      edges: assetNodes.map((node) => ({
        id: `${node.id}:${feature.id}:${node.type}`,
        sourceNodeId: node.id,
        targetNodeId: feature.id,
        targetHandle: node.type as ProjectAgentAssetNodeType,
      })),
    },
  };
}

test('video clone resolves video + text only to edit-video mode', () => {
  assert.equal(getProjectAgentVideoCloneMode({ video, text }), 'edit_video');
  assert.equal(getProjectAgentVideoCloneDurationSeconds({ video, text }), 9);
  assert.deepEqual(getProjectAgentVideoCloneAllowedModels('edit_video'), ['seedance_2', 'seedance_2_fast']);
});

test('video clone keeps avatar-backed runs in clone mode', () => {
  assert.equal(getProjectAgentVideoCloneMode({ video, text, avatar }), 'clone');
  assert.deepEqual(getProjectAgentVideoCloneAllowedModels('clone'), ['seedance_2', 'seedance_2_fast', 'kling_3']);
});

test('video + text only satisfies video clone inputs', () => {
  const videoNode = createProjectAgentAssetNode({ type: 'video', x: 0, y: 0, asset: video });
  const textNode = createProjectAgentAssetNode({ type: 'text', x: 0, y: 0, asset: text });
  const { state, feature } = buildState([videoNode, textNode]);
  assert.deepEqual(getMissingFeatureInputs(state, feature.id), []);
  assert.equal(getFeatureStartBlockedReason(state, feature.id), null);
});

test('edit-video mode blocks missing or out-of-range source duration', () => {
  const unknownVideoNode = createProjectAgentAssetNode({ type: 'video', x: 0, y: 0, asset: { ...video, durationSeconds: null } });
  const textNode = createProjectAgentAssetNode({ type: 'text', x: 0, y: 0, asset: text });
  const unknown = buildState([unknownVideoNode, textNode]);
  assert.equal(getFeatureStartBlockedReason(unknown.state, unknown.feature.id), 'Source video duration is unavailable.');

  const longVideoNode = createProjectAgentAssetNode({ type: 'video', x: 0, y: 0, asset: { ...video, durationSeconds: 16 } });
  const longState = buildState([longVideoNode, textNode]);
  assert.equal(getFeatureStartBlockedReason(longState.state, longState.feature.id), 'Source video must be 2-15s. Current: 16s.');
});

test('edit-video payload rounds source duration up to the executable whole second', () => {
  const payload = buildVideoCloneStartPayload({
    video: { ...video, durationSeconds: 13.766667 },
    text,
    config: { videoModel: 'seedance_2_fast' },
  });

  assert.equal(payload.videoDuration, '14');
});

test('edit-video payload uses source video and prompt without replacement assets', () => {
  const payload = buildVideoCloneStartPayload({
    video,
    text,
    config: { videoModel: 'kling_3', videoDuration: '8' },
  });

  assert.equal(payload.executionMode, 'edit_video');
  assert.equal(payload.videoModel, 'seedance_2');
  assert.equal(payload.videoDuration, '9');
  assert.equal(payload.editVideoPrompt, 'Add a soft cinematic glow.');
  assert.equal(payload.editVideoSourceUrl, 'https://example.com/source.mp4');
  assert.deepEqual(payload.selectedAvatarIds, []);
  assert.deepEqual(payload.selectedProductIds, []);
});
