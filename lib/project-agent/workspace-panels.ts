export type ProjectAgentWorkspacePanel = 'my_ads' | 'assets';

export function getNextWorkspacePanel(
  current: ProjectAgentWorkspacePanel | null,
  requested: ProjectAgentWorkspacePanel,
) {
  return current === requested ? null : requested;
}

export function getWorkspacePanelVisibility(activePanel: ProjectAgentWorkspacePanel | null) {
  return {
    assetsMounted: true,
    assetsVisible: activePanel === 'assets',
    myAdsMounted: true,
    myAdsVisible: activePanel === 'my_ads',
  };
}
