import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextWorkspacePanel } from '@/lib/project-agent/workspace-panels';

test('workspace panels toggle and stay mutually exclusive', () => {
  assert.equal(getNextWorkspacePanel(null, 'my_ads'), 'my_ads');
  assert.equal(getNextWorkspacePanel('my_ads', 'assets'), 'assets');
  assert.equal(getNextWorkspacePanel('assets', 'assets'), null);
});
