import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  canRunFeatureNode,
  connectCanvasNodes,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentFeatureNode,
  getCanvasConnectionError,
  getMissingFeatureInputs,
  PROJECT_AGENT_FEATURE_INPUTS,
  type ProjectAgentCanvasState,
  type ProjectAgentCanvasAssetRef,
} from '@/lib/project-agent/canvas-state';
import { toProjectAgentVideoAssets } from '@/lib/project-agent/canvas-assets';
import { startMotionClone } from '@/app/api/project-agent/canvas-run/route';

const motionCloneAssets = {
  avatar: {
    id: 'avatar-1',
    name: 'Avatar 1',
    imageUrl: 'https://example.com/avatar.png',
  },
  product: {
    id: 'product-1',
    name: 'Product 1',
    imageUrl: 'https://example.com/product.png',
  },
  video: {
    id: 'video-1',
    name: 'Creator Video',
    sourceType: 'creator',
    imageUrl: 'https://example.com/video-cover.png',
    videoUrl: 'https://example.com/video.mp4',
  },
} satisfies Record<'avatar' | 'product' | 'video', ProjectAgentCanvasAssetRef>;

test('motion clone canvas nodes require a video plus avatar or product', () => {
  const avatarNode = createProjectAgentAssetNode({
    type: 'avatar',
    x: 0,
    y: 0,
    asset: motionCloneAssets.avatar,
  });
  const productNode = createProjectAgentAssetNode({
    type: 'product',
    x: 280,
    y: 0,
    asset: motionCloneAssets.product,
  });
  const videoNode = createProjectAgentAssetNode({
    type: 'video',
    x: 560,
    y: 0,
    asset: motionCloneAssets.video,
  });
  const featureNode = createProjectAgentFeatureNode({
    type: 'motion_clone',
    x: 840,
    y: 0,
  });

  assert.deepEqual(PROJECT_AGENT_FEATURE_INPUTS.motion_clone, ['video']);
  assert.equal(featureNode.config?.aspectRatio, '9:16');
  assert.equal(featureNode.config?.language, 'en');
  assert.equal(featureNode.config?.videoDuration, '8');
  assert.equal(featureNode.config?.videoModel, 'kling_3');
  assert.equal(featureNode.config?.videoQuality, '720p');
  assert.equal(featureNode.runtime?.executionState, 'invalid');

  let state: ProjectAgentCanvasState = {
    nodes: [avatarNode, productNode, videoNode, featureNode],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    selectedNodeIds: [],
    chatDrawerOpen: true,
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
    id: createProjectAgentCanvasEdgeId(avatarNode.id, featureNode.id, 'avatar'),
    sourceNodeId: avatarNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'avatar',
  });

  assert.deepEqual(getMissingFeatureInputs(state, featureNode.id), []);
  assert.equal(canRunFeatureNode(state, featureNode.id), true);
});

test('startMotionClone chains create, start, and status requests for creator videos', async () => {
  const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'test-secret';

  const fetchCalls: Array<{
    input: RequestInfo | URL;
    init?: RequestInit;
  }> = [];

  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/api/motion-clone/create')) {
      return new Response(JSON.stringify({ project: { id: 'motion-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/api/motion-clone/motion-1/start')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/api/motion-clone/motion-1/status')) {
      return new Response(JSON.stringify({
        project: {
          id: 'motion-1',
          status: 'generating_preview',
          preview_image_url: 'https://example.com/preview.png',
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    const execution = await startMotionClone('https://example.com', 'user-1', {
      connectedAssets: motionCloneAssets,
      config: {
        aspectRatio: '16:9',
        language: 'en',
        videoQuality: '1080p',
      },
    });

    assert.equal(execution.projectId, 'motion-1');
    assert.equal(execution.phase, 'generating_preview');
    assert.equal(execution.previewUrl, 'https://example.com/preview.png');
    assert.equal(execution.table, 'motion_clone_projects');
    assert.equal(execution.statusLabel, 'Running motion clone');
    assert.equal(fetchCalls.length, 3);

    const [createCall, startCall, statusCall] = fetchCalls;
    assert.equal(typeof createCall?.input === 'string' ? createCall.input : createCall?.input.toString(), 'https://example.com/api/motion-clone/create');
    assert.equal(typeof startCall?.input === 'string' ? startCall.input : startCall?.input.toString(), 'https://example.com/api/motion-clone/motion-1/start');
    assert.equal(typeof statusCall?.input === 'string' ? statusCall.input : statusCall?.input.toString(), 'https://example.com/api/motion-clone/motion-1/status');

    const startHeaders = new Headers(startCall?.init?.headers);
    assert.equal(startHeaders.get('x-project-agent-user-id'), 'user-1');
    assert.ok(startHeaders.get('x-project-agent-timestamp'));
    assert.ok(startHeaders.get('x-project-agent-signature'));

    const requestBody = JSON.parse(String(startCall?.init?.body));
    assert.deepEqual(requestBody, {
      reference_video_id: 'video-1',
      avatar_id: 'avatar-1',
      product_id: 'product-1',
      action: 'video',
      mode: '1080p',
    });
  } finally {
    mock.restoreAll();
    if (originalClerkSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
    }
  }
});

test('startMotionClone rejects competitor ad references before making requests', async () => {
  await assert.rejects(
    () => startMotionClone('https://example.com', 'user-1', {
      connectedAssets: {
        avatar: motionCloneAssets.avatar,
        product: motionCloneAssets.product,
        video: {
          ...motionCloneAssets.video,
          sourceType: 'reference_video',
        },
      },
    }),
    /Motion Clone requires a creator video, not a reference video\./
  );
});

test('startMotionClone allows product-only swaps for creator videos', async () => {
  const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'test-secret';

  mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/api/motion-clone/create')) {
      return new Response(JSON.stringify({ project: { id: 'motion-2' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/api/motion-clone/motion-2/start')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/api/motion-clone/motion-2/status')) {
      return new Response(JSON.stringify({
        project: {
          id: 'motion-2',
          status: 'generating_preview',
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    const execution = await startMotionClone('https://example.com', 'user-1', {
      connectedAssets: {
        product: motionCloneAssets.product,
        video: motionCloneAssets.video,
      },
      config: {
        videoQuality: '720p',
      },
    });

    assert.equal(execution.projectId, 'motion-2');
  } finally {
    mock.restoreAll();
    if (originalClerkSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
    }
  }
});

test('toProjectAgentVideoAssets keeps only motion-clone-ready creator videos', () => {
  const videos = toProjectAgentVideoAssets([
    {
      id: 'creator-missing-cover',
      source_name: 'Creator Missing Cover',
      source_type: 'creator',
      cover_url: null,
      video_url: 'https://example.com/missing-cover.mp4',
    },
    {
      id: 'creator-ready',
      source_name: 'Creator Ready',
      source_type: 'creator',
      cover_url: 'https://example.com/cover.png',
      video_url: 'https://example.com/ready.mp4',
    },
    {
      id: 'competitor-1',
      description: 'Competitor Ad',
      source_type: 'reference_video',
      cover_url: null,
      video_url: 'https://example.com/competitor.mp4',
    },
  ]);

  assert.deepEqual(
    videos.map((video) => video.id),
    ['creator-ready', 'competitor-1']
  );
});

test('motion clone rejects videos without a cover image at connection time', () => {
  const videoNode = createProjectAgentAssetNode({
    type: 'video',
    x: 0,
    y: 0,
    asset: {
      id: 'video-no-cover',
      name: 'Video Without Cover',
      sourceType: 'creator',
      imageUrl: null,
      videoUrl: 'https://example.com/video.mp4',
    },
  });
  const featureNode = createProjectAgentFeatureNode({
    type: 'motion_clone',
    x: 280,
    y: 0,
  });

  const state: ProjectAgentCanvasState = {
    nodes: [videoNode, featureNode],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    selectedNodeIds: [],
    chatDrawerOpen: true,
  };
  const edge = {
    id: createProjectAgentCanvasEdgeId(videoNode.id, featureNode.id, 'video'),
    sourceNodeId: videoNode.id,
    targetNodeId: featureNode.id,
    targetHandle: 'video' as const,
  };

  assert.equal(
    getCanvasConnectionError(state, edge),
    'This video needs a cover image before it can connect to Motion Clone.'
  );
  assert.deepEqual(connectCanvasNodes(state, edge).edges, []);
});
