import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_PROJECT_AGENT_CANVAS_STATE } from '@/lib/project-agent/canvas-state';
import { planProjectAgentCanvasCommand } from '@/lib/project-agent/canvas-command-planner';

test('planner opens the video picker for clone-video intent', () => {
  const plan = planProjectAgentCanvasCommand(
    'I want to clone a video',
    DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  );

  assert.ok(plan);
  assert.equal(plan?.type, 'asset_selection');
  if (plan?.type !== 'asset_selection') return;
  assert.equal(plan.request.assetType, 'video');
  assert.equal(plan.request.title, 'Select a video for Video Clone');
});

test('planner requests confirmation before deleting a multi-selection', () => {
  const plan = planProjectAgentCanvasCommand('Delete selected nodes', {
    ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
    selectedNodeId: 'node-1',
    selectedNodeIds: ['node-1', 'node-2'],
  });

  assert.ok(plan);
  assert.equal(plan?.type, 'confirmation');
  if (plan?.type !== 'confirmation') return;
  assert.equal(plan.request.confirmationType, 'delete_nodes');
});

test('planner formats the canvas on explicit layout commands', () => {
  const plan = planProjectAgentCanvasCommand('Please format canvas', DEFAULT_PROJECT_AGENT_CANVAS_STATE);

  assert.ok(plan);
  assert.equal(plan?.type, 'safe_edit');
  if (plan?.type !== 'safe_edit') return;
  assert.equal(plan.actions[0]?.kind, 'canvas_mutation');
  if (plan.actions[0]?.kind !== 'canvas_mutation') return;
  assert.equal(plan.actions[0].mutation.type, 'format_layout');
});
