import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_PROJECT_AGENT_CANVAS_STATE } from '@/lib/project-agent/canvas-state';
import { planProjectAgentCanvasCommand } from '@/lib/project-agent/canvas-command-planner';
import { matchesAssetReference } from '@/lib/project-agent/asset-name-match';

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

test('asset matching tolerates summarized video labels against longer source descriptions', () => {
  assert.equal(
    matchesAssetReference(
      'Use Magnesium supplement scam warning as the reference video.',
      'Beware… Don’t get scammed! This doctor recommended magnesium complex — is it worth it?',
    ),
    true,
  );
});

test('planner reuses the single video and product on canvas when adding a motion clone workflow', () => {
  const plan = planProjectAgentCanvasCommand(
    'Now use the same video to add a motion clone workflow for Default Female and keep the red lapel pin in the canvas.',
    {
      ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
      nodes: [
        {
          id: 'video-1',
          type: 'video',
          label: 'Three toddlers and a small dog',
          asset: { id: 'video-1', name: 'Three toddlers and a small dog' },
          runtime: null,
          x: 80,
          y: 80,
        },
        {
          id: 'product-1',
          type: 'product',
          label: 'red lapel pin',
          asset: { id: 'product-1', name: 'red lapel pin' },
          runtime: null,
          x: 80,
          y: 428,
        },
      ],
    },
  );

  assert.ok(plan);
  assert.equal(plan?.type, 'safe_edit');
  if (plan?.type !== 'safe_edit') return;
  const mutations = plan.actions
    .filter((action) => action.kind === 'canvas_mutation')
    .map((action) => action.mutation);

  assert.ok(mutations.some((mutation) => mutation.type === 'add_asset_node' && mutation.assetType === 'video'));
  assert.ok(mutations.some((mutation) => mutation.type === 'add_asset_node' && mutation.assetType === 'product'));
  assert.ok(mutations.some((mutation) => mutation.type === 'add_asset_node' && mutation.assetType === 'avatar'));
  assert.ok(mutations.some((mutation) => mutation.type === 'add_feature_node' && mutation.featureType === 'motion_clone'));
});

test('planner treats explicit "do not convert into motion clone" as a no-op guardrail', () => {
  const plan = planProjectAgentCanvasCommand(
    'Keep both workflows separate and do not convert either one into motion clone.',
    DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  );

  assert.ok(plan);
  assert.equal(plan?.type, 'inspect_only');
  if (plan?.type !== 'inspect_only') return;
  assert.equal(plan.reply, 'I kept the current workflows unchanged.');
});
