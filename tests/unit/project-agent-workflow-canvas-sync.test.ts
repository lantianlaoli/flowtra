import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_PROJECT_AGENT_CANVAS_STATE } from '@/lib/project-agent/canvas-state';
import {
  syncAvatarAdsCanvasState,
  syncProjectAgentWorkflowCanvasState,
  syncVideoCloneCanvasState,
} from '@/lib/project-agent/workflow-canvas-sync';

test('syncAvatarAdsCanvasState reconstructs avatar ads graph with product and script', () => {
  const nextCanvas = syncAvatarAdsCanvasState(DEFAULT_PROJECT_AGENT_CANVAS_STATE, {
    avatarSelection: {
      avatar: { id: 'avatar-1', name: 'Default Female', photoUrl: 'https://example.com/avatar.png' },
      product: { id: 'product-1', name: 'diet-1', photoUrl: 'https://example.com/product.png' },
    },
    avatarDraft: {
      scriptSource: 'Introduce diet-1 with a premium spokesperson tone.',
    },
  });

  assert.equal(nextCanvas.nodes.some((node) => node.type === 'avatar_ads'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'avatar' && node.asset?.name === 'Default Female'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'product' && node.asset?.name === 'diet-1'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'text' && node.asset?.content?.includes('diet-1')), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'avatar'), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'product'), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'text'), true);
});

test('syncVideoCloneCanvasState reconstructs video clone graph with product input', () => {
  const nextCanvas = syncVideoCloneCanvasState(DEFAULT_PROJECT_AGENT_CANVAS_STATE, {
    cloneReferenceVideo: {
      id: 'video-1',
      name: 'Health Supplements 1',
      sourceType: 'creator',
      videoUrl: 'https://example.com/video.mp4',
      cdnUrl: 'https://cdn.example.com/video.mp4',
      analysisLanguage: 'en',
    },
    cloneReplacementDraft: {
      selectedProducts: [{ id: 'product-1', name: 'diet-1', photoUrl: 'https://example.com/product.png' }],
      selectedProduct: { id: 'product-1', name: 'diet-1', photoUrl: 'https://example.com/product.png' },
    },
  });

  assert.equal(nextCanvas.nodes.some((node) => node.type === 'video_clone'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'video' && node.asset?.name === 'Health Supplements 1'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'product' && node.asset?.name === 'diet-1'), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'video'), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'product'), true);
});

test('syncVideoCloneCanvasState falls back to avatar input when product is absent', () => {
  const nextCanvas = syncVideoCloneCanvasState(DEFAULT_PROJECT_AGENT_CANVAS_STATE, {
    cloneReferenceVideo: {
      id: 'video-1',
      name: 'Decorations 1',
      sourceType: 'creator',
    },
    cloneReplacementDraft: {
      selectedAvatars: [{ id: 'avatar-1', name: 'Default Founder', photoUrl: 'https://example.com/avatar.png' }],
      selectedAvatar: { id: 'avatar-1', name: 'Default Founder', photoUrl: 'https://example.com/avatar.png' },
    },
  });

  assert.equal(nextCanvas.nodes.some((node) => node.type === 'video_clone'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'avatar' && node.asset?.name === 'Default Founder'), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'avatar'), true);
});

test('syncProjectAgentWorkflowCanvasState reconstructs a partial motion clone graph from reference video only', () => {
  const nextCanvas = syncProjectAgentWorkflowCanvasState(DEFAULT_PROJECT_AGENT_CANVAS_STATE, {
    motionClone: {
      projectId: null,
      stage: 'replacement_selection',
      phase: 'idle',
      referenceVideo: {
        id: 'video-1',
        description: 'brush-1',
        videoUrl: 'https://example.com/video.mp4',
        videoCdnUrl: 'https://cdn.example.com/video.mp4',
        coverUrl: 'https://example.com/cover.png',
        durationSeconds: 27,
        analysisLanguage: 'en',
      },
      selectedAvatar: null,
      selectedProduct: null,
      videoQuality: '720p',
      photoPrompt: '',
      videoPrompt: '',
      previewImageUrl: null,
      outputVideoUrl: null,
      error: null,
      promptsInitialized: false,
    },
  });

  assert.equal(nextCanvas.nodes.some((node) => node.type === 'motion_clone'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'video' && node.asset?.name === 'brush-1'), true);
  assert.equal(nextCanvas.edges.some((edge) => edge.targetHandle === 'video'), true);
});

test('syncProjectAgentWorkflowCanvasState keeps multiple workflow graphs together', () => {
  const nextCanvas = syncProjectAgentWorkflowCanvasState(DEFAULT_PROJECT_AGENT_CANVAS_STATE, {
    avatarSelection: {
      avatar: { id: 'avatar-1', name: 'Default Female', photoUrl: 'https://example.com/avatar.png' },
      product: { id: 'product-1', name: 'diet-1', photoUrl: 'https://example.com/product.png' },
    },
    avatarDraft: {
      scriptSource: 'Pitch diet-1 clearly.',
    },
    cloneReferenceVideo: {
      id: 'video-1',
      name: 'Health Supplements 1',
      sourceType: 'creator',
      videoUrl: 'https://example.com/video.mp4',
    },
    cloneReplacementDraft: {
      selectedProducts: [{ id: 'product-1', name: 'diet-1', photoUrl: 'https://example.com/product.png' }],
      selectedProduct: { id: 'product-1', name: 'diet-1', photoUrl: 'https://example.com/product.png' },
    },
  });

  assert.equal(nextCanvas.nodes.some((node) => node.type === 'avatar_ads'), true);
  assert.equal(nextCanvas.nodes.some((node) => node.type === 'video_clone'), true);
  assert.equal(nextCanvas.nodes.filter((node) => node.type === 'product' && node.asset?.name === 'diet-1').length >= 1, true);
});
