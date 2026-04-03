import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_PROJECT_AGENT_CANVAS_STATE } from '@/lib/project-agent/canvas-state';
import {
  executeProjectAgentCanvasActions,
  type ProjectAgentCanvasAction,
} from '@/lib/project-agent/canvas-actions';

test('canvas executor resolves aliases across multi-step mutations', () => {
  const actions: ProjectAgentCanvasAction[] = [
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'selectedVideo',
        assetType: 'video',
        asset: {
          id: 'video-1',
          name: 'Reference video',
          imageUrl: 'https://example.com/video.png',
        },
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_feature_node',
        alias: 'cloneNode',
        featureType: 'video_clone',
        placement: {
          kind: 'relative',
          ref: { kind: 'alias', alias: 'selectedVideo' },
          dx: 280,
          dy: 0,
        },
        select: true,
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'selectedVideo' },
        target: { kind: 'alias', alias: 'cloneNode' },
        targetHandle: 'video',
      },
    },
  ];

  const result = executeProjectAgentCanvasActions({
    canvas: DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    actions,
  });

  assert.equal(result.canvas.nodes.length, 2);
  assert.equal(result.canvas.edges.length, 1);
  const featureNode = result.canvas.nodes.find((node) => node.type === 'video_clone');
  assert.ok(featureNode);
  assert.equal(result.canvas.selectedNodeId, featureNode?.id);
});

test('canvas executor requires confirmation action to exist outside direct mutations', () => {
  const base = executeProjectAgentCanvasActions({
    canvas: {
      ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
      selectedNodeId: 'node-1',
      selectedNodeIds: ['node-1', 'node-2'],
      nodes: [
        { id: 'node-1', type: 'text', x: 0, y: 0, label: 'A', asset: { id: 'a', name: 'A', content: 'A' } },
        { id: 'node-2', type: 'text', x: 0, y: 100, label: 'B', asset: { id: 'b', name: 'B', content: 'B' } },
      ],
      edges: [],
    },
    actions: [
      {
        kind: 'ui_action',
        action: {
          type: 'request_confirmation',
          request: {
            type: 'confirmation',
            confirmationType: 'delete_nodes',
            title: 'Delete selected nodes?',
            message: 'Remove them.',
            mutations: [{ type: 'delete_nodes', targets: [{ kind: 'selected' }] }],
          },
        },
      },
    ],
  });

  assert.equal(base.canvas.nodes.length, 2);
  assert.equal(base.pendingUiRequest?.type, 'confirmation');

  const confirmed = executeProjectAgentCanvasActions({
    canvas: base.canvas,
    pendingUiRequest: base.pendingUiRequest,
    actions: [
      {
        kind: 'canvas_mutation',
        mutation: {
          type: 'delete_nodes',
          targets: [{ kind: 'selected' }],
        },
      },
      {
        kind: 'ui_action',
        action: {
          type: 'clear_pending_request',
        },
      },
    ],
  });

  assert.equal(confirmed.canvas.nodes.length, 0);
  assert.equal(confirmed.pendingUiRequest, null);
});

test('canvas executor reuses existing asset node when requested', () => {
  const first = executeProjectAgentCanvasActions({
    canvas: DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    actions: [
      {
        kind: 'canvas_mutation',
        mutation: {
          type: 'add_asset_node',
          alias: 'selectedVideo',
          assetType: 'video',
          asset: { id: 'video-1', name: 'Reference' },
          reuseExisting: true,
        },
      },
    ],
  });

  const second = executeProjectAgentCanvasActions({
    canvas: first.canvas,
    actions: [
      {
        kind: 'canvas_mutation',
        mutation: {
          type: 'add_asset_node',
          alias: 'selectedVideoAgain',
          assetType: 'video',
          asset: { id: 'video-1', name: 'Reference' },
          reuseExisting: true,
        },
      },
    ],
  });

  assert.equal(second.canvas.nodes.length, 1);
  assert.equal(second.createdAliases.selectedVideoAgain, second.canvas.nodes[0]?.id);
});

test('canvas executor ignores malformed mutation actions instead of throwing', () => {
  const result = executeProjectAgentCanvasActions({
    canvas: DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    actions: [
      {
        kind: 'canvas_mutation',
        mutation: {
          type: 'add_feature_node',
          featureType: 'video_clone',
        },
      },
      { kind: 'canvas_mutation' } as unknown as ProjectAgentCanvasAction,
      { kind: 'ui_action' } as unknown as ProjectAgentCanvasAction,
    ],
  });

  assert.equal(result.canvas.nodes.length, 1);
  assert.equal(result.canvas.nodes[0]?.type, 'video_clone');
});
