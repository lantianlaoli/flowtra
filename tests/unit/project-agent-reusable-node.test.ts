import test from 'node:test';
import assert from 'node:assert/strict';
import { getReusableFeatureRuntimeAfterCompletion } from '@/lib/project-agent/node-execution';

test('completed feature nodes return to ready state for reuse while preserving latest project id', () => {
  const runtime = getReusableFeatureRuntimeAfterCompletion({
    executionState: 'completed',
    projectId: 'project-1',
    phase: 'completed',
    progress: 100,
    outputUrl: 'https://example.com/out.mp4',
    previewUrl: null,
    error: null,
    userFacingError: null,
    retryable: false,
    statusLabel: 'Completed',
    milestones: [],
    currentMilestoneKey: 'completed',
    table: 'video_clone_projects',
    nextAction: 'none',
  });

  assert.equal(runtime.executionState, 'ready');
  assert.equal(runtime.projectId, 'project-1');
  assert.equal(runtime.milestones, null);
  assert.equal(runtime.statusLabel, 'Ready');
});
