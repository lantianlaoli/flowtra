import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkspacePanelVisibility } from '../../lib/project-agent/workspace-panels';

test('workspace panels stay mounted while only the active panel is visible', () => {
  assert.deepEqual(getWorkspacePanelVisibility('assets'), {
    assetsMounted: true,
    assetsVisible: true,
    myAdsMounted: true,
    myAdsVisible: false,
  });

  assert.deepEqual(getWorkspacePanelVisibility(null), {
    assetsMounted: true,
    assetsVisible: false,
    myAdsMounted: true,
    myAdsVisible: false,
  });
});
