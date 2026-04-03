import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  PROJECT_AGENT_FEATURE_INPUTS,
  PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS,
  PROJECT_AGENT_FEATURE_ANY_OF_INPUTS,
  connectCanvasNodes,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentCanvasNodeId,
  createProjectAgentFeatureNode,
  getCanvasConnectionError,
  getProjectAgentCanvasNodeById,
  getProjectAgentCanvasNodeSize,
  isProjectAgentAssetNode,
  isProjectAgentFeatureNode,
  removeCanvasEdge,
  removeCanvasNode,
  upsertCanvasNode,
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasAssetRef,
  type ProjectAgentCanvasEdge,
  type ProjectAgentCanvasNode,
  type ProjectAgentCanvasNodeType,
  type ProjectAgentCanvasState,
  type ProjectAgentFeatureNodeConfig,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';

export type ProjectAgentSelectableAssetType = Exclude<ProjectAgentAssetNodeType, 'text'>;

export type ProjectAgentCanvasNodeRef =
  | { kind: 'node_id'; nodeId: string }
  | { kind: 'alias'; alias: string }
  | { kind: 'selected' }
  | { kind: 'first_of_type'; nodeType: ProjectAgentCanvasNodeType }
  | { kind: 'asset'; assetType: ProjectAgentAssetNodeType; assetId?: string }
  | { kind: 'feature'; featureType: ProjectAgentFeatureNodeType };

export type ProjectAgentCanvasNodePlacement =
  | { kind: 'default' }
  | { kind: 'absolute'; x: number; y: number }
  | { kind: 'relative'; ref: ProjectAgentCanvasNodeRef; dx: number; dy: number };

export type ProjectAgentCanvasMutation =
  | {
      type: 'add_asset_node';
      alias?: string;
      assetType: ProjectAgentAssetNodeType;
      asset?: ProjectAgentCanvasAssetRef;
      useSelectedAsset?: boolean;
      placement?: ProjectAgentCanvasNodePlacement;
      reuseExisting?: boolean;
      select?: boolean;
    }
  | {
      type: 'add_feature_node';
      alias?: string;
      featureType: ProjectAgentFeatureNodeType;
      config?: Partial<ProjectAgentFeatureNodeConfig> | null;
      placement?: ProjectAgentCanvasNodePlacement;
      reuseExisting?: boolean;
      select?: boolean;
    }
  | {
      type: 'add_text_node';
      alias?: string;
      content?: string;
      label?: string;
      placement?: ProjectAgentCanvasNodePlacement;
      reuseExisting?: boolean;
      select?: boolean;
    }
  | {
      type: 'connect_nodes';
      source: ProjectAgentCanvasNodeRef;
      target: ProjectAgentCanvasNodeRef;
      targetHandle: ProjectAgentAssetNodeType;
    }
  | {
      type: 'disconnect_edge';
      edgeId?: string;
      source?: ProjectAgentCanvasNodeRef;
      target?: ProjectAgentCanvasNodeRef;
      targetHandle?: ProjectAgentAssetNodeType;
    }
  | {
      type: 'delete_nodes';
      targets: ProjectAgentCanvasNodeRef[];
    }
  | {
      type: 'clear_canvas';
    }
  | {
      type: 'update_text_content';
      target: ProjectAgentCanvasNodeRef;
      content: string;
    }
  | {
      type: 'update_feature_config';
      target: ProjectAgentCanvasNodeRef;
      config: Partial<ProjectAgentFeatureNodeConfig>;
    }
  | {
      type: 'select_nodes';
      targets: ProjectAgentCanvasNodeRef[];
    }
  | {
      type: 'open_node_details';
      target: ProjectAgentCanvasNodeRef;
    }
  | {
      type: 'format_layout';
    };

export type ProjectAgentPendingAssetSelectionRequest = {
  type: 'asset_selection';
  assetType: ProjectAgentSelectableAssetType;
  nodeAlias: string;
  title: string;
  instructions: string;
  mutations: ProjectAgentCanvasMutation[];
};

export type ProjectAgentPendingConfirmationRequest = {
  type: 'confirmation';
  confirmationType: 'clear_canvas' | 'delete_nodes' | 'replace_graph';
  title: string;
  message: string;
  mutations: ProjectAgentCanvasMutation[];
};

export type ProjectAgentPendingUiRequest =
  | ProjectAgentPendingAssetSelectionRequest
  | ProjectAgentPendingConfirmationRequest;

export type ProjectAgentCanvasUiAction =
  | {
      type: 'open_asset_picker';
      request: ProjectAgentPendingAssetSelectionRequest;
    }
  | {
      type: 'request_confirmation';
      request: ProjectAgentPendingConfirmationRequest;
    }
  | {
      type: 'clear_pending_request';
    }
  | {
      type: 'set_status_note';
      message: string;
    };

export type ProjectAgentCanvasAction =
  | {
      kind: 'canvas_mutation';
      mutation: ProjectAgentCanvasMutation;
    }
  | {
      kind: 'ui_action';
      action: ProjectAgentCanvasUiAction;
    };

export type ProjectAgentCanvasMutationExecutorResult = {
  canvas: ProjectAgentCanvasState;
  detailNodeId: string | null;
  pendingUiRequest: ProjectAgentPendingUiRequest | null;
  statusNote: string;
  createdAliases: Record<string, string>;
};

const isCanvasMutationAction = (
  action: ProjectAgentCanvasAction | Record<string, unknown> | null | undefined
): action is Extract<ProjectAgentCanvasAction, { kind: 'canvas_mutation' }> => {
  if (!action || typeof action !== 'object') {
    return false;
  }

  const record = action as { kind?: unknown; mutation?: { type?: unknown } };
  return record.kind === 'canvas_mutation' && typeof record.mutation?.type === 'string';
};

const isCanvasUiAction = (
  action: ProjectAgentCanvasAction | Record<string, unknown> | null | undefined
): action is Extract<ProjectAgentCanvasAction, { kind: 'ui_action' }> => {
  if (!action || typeof action !== 'object') {
    return false;
  }

  const record = action as { kind?: unknown; action?: { type?: unknown } };
  return record.kind === 'ui_action' && typeof record.action?.type === 'string';
};

type ProjectAgentCanvasMutationExecutorOptions = {
  canvas: ProjectAgentCanvasState;
  actions: ProjectAgentCanvasAction[];
  detailNodeId?: string | null;
  pendingUiRequest?: ProjectAgentPendingUiRequest | null;
  selectedAsset?: ProjectAgentCanvasAssetRef | null;
};

const DEFAULT_ALIAS_FOR_SELECTED_ASSET = 'selectedAsset';

export const normalizeProjectAgentPendingUiRequest = (
  value: unknown
): ProjectAgentPendingUiRequest | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.type === 'asset_selection') {
    if (
      (record.assetType !== 'avatar' && record.assetType !== 'product' && record.assetType !== 'video') ||
      typeof record.nodeAlias !== 'string' ||
      typeof record.title !== 'string' ||
      typeof record.instructions !== 'string' ||
      !Array.isArray(record.mutations)
    ) {
      return null;
    }

    return {
      type: 'asset_selection',
      assetType: record.assetType as ProjectAgentSelectableAssetType,
      nodeAlias: record.nodeAlias,
      title: record.title,
      instructions: record.instructions,
      mutations: record.mutations as ProjectAgentCanvasMutation[],
    };
  }

  if (record.type === 'confirmation') {
    if (
      typeof record.confirmationType !== 'string' ||
      typeof record.title !== 'string' ||
      typeof record.message !== 'string' ||
      !Array.isArray(record.mutations)
    ) {
      return null;
    }

    return {
      type: 'confirmation',
      confirmationType: record.confirmationType as ProjectAgentPendingConfirmationRequest['confirmationType'],
      title: record.title,
      message: record.message,
      mutations: record.mutations as ProjectAgentCanvasMutation[],
    };
  }

  return null;
};

const getDefaultNodePlacement = (canvas: ProjectAgentCanvasState) => ({
  x: 240 - canvas.viewport.x / canvas.viewport.zoom,
  y: 180 - canvas.viewport.y / canvas.viewport.zoom,
});

const getResolvedPlacement = (
  canvas: ProjectAgentCanvasState,
  placement: ProjectAgentCanvasNodePlacement | undefined,
  resolveNode: (ref: ProjectAgentCanvasNodeRef) => ProjectAgentCanvasNode | null
) => {
  if (!placement || placement.kind === 'default') {
    return getDefaultNodePlacement(canvas);
  }

  if (placement.kind === 'absolute') {
    return { x: placement.x, y: placement.y };
  }

  const baseNode = resolveNode(placement.ref);
  if (!baseNode) {
    return getDefaultNodePlacement(canvas);
  }

  return {
    x: baseNode.x + placement.dx,
    y: baseNode.y + placement.dy,
  };
};

const findExistingAssetNode = (
  canvas: ProjectAgentCanvasState,
  assetType: ProjectAgentAssetNodeType,
  asset: ProjectAgentCanvasAssetRef | undefined
) => {
  if (!asset?.id) return null;
  return canvas.nodes.find((node) => (
    node.type === assetType &&
    node.asset?.id === asset.id
  )) || null;
};

const findExistingFeatureNode = (
  canvas: ProjectAgentCanvasState,
  featureType: ProjectAgentFeatureNodeType
) => canvas.nodes.find((node) => node.type === featureType) || null;

const resolveEdgeId = (
  canvas: ProjectAgentCanvasState,
  sourceNodeId: string,
  targetNodeId: string,
  targetHandle: ProjectAgentAssetNodeType
) => {
  const directId = createProjectAgentCanvasEdgeId(sourceNodeId, targetNodeId, targetHandle);
  return canvas.edges.find((edge) => edge.id === directId)?.id || directId;
};

const resolveTargetIds = (
  canvas: ProjectAgentCanvasState,
  targets: ProjectAgentCanvasNodeRef[],
  resolveNode: (ref: ProjectAgentCanvasNodeRef) => ProjectAgentCanvasNode | null
) => {
  const resolvedIds: string[] = [];

  targets.forEach((target) => {
    if (target.kind === 'selected') {
      const selectedIds = canvas.selectedNodeIds.length > 0
        ? canvas.selectedNodeIds
        : canvas.selectedNodeId
          ? [canvas.selectedNodeId]
          : [];
      selectedIds.forEach((selectedId) => {
        if (!resolvedIds.includes(selectedId)) {
          resolvedIds.push(selectedId);
        }
      });
      return;
    }

    const node = resolveNode(target);
    if (!node || resolvedIds.includes(node.id)) return;
    resolvedIds.push(node.id);
  });

  return resolvedIds;
};

const formatCanvasNodes = (canvas: ProjectAgentCanvasState) => {
  const ASSET_X = 80;
  const FEATURE_X = 360;
  const OUTPUT_X = 710;
  const START_Y = 80;
  const VERTICAL_GAP = 40;

  const getNodeHeight = (node: ProjectAgentCanvasNode) => {
    if (node.type === 'video') return 308;
    if (isProjectAgentAssetNode(node.type)) return 210;
    if (isProjectAgentFeatureNode(node.type)) return 216;
    return 308;
  };

  const placeColumn = (nodes: ProjectAgentCanvasNode[], x: number, startY: number) => {
    let y = startY;
    return nodes.map((node) => {
      const positioned = { ...node, x, y };
      y += getNodeHeight(node) + VERTICAL_GAP;
      return positioned;
    });
  };

  const assetNodes = canvas.nodes.filter((node) => isProjectAgentAssetNode(node.type));
  const featureNodes = canvas.nodes.filter((node) => isProjectAgentFeatureNode(node.type));
  const outputNodes = canvas.nodes.filter((node) => node.type === 'output_video');

  const totalHeight = (nodes: ProjectAgentCanvasNode[]) =>
    nodes.reduce((sum, node, index) => (
      sum + getNodeHeight(node) + (index < nodes.length - 1 ? VERTICAL_GAP : 0)
    ), 0);

  const maxHeight = Math.max(
    totalHeight(assetNodes),
    totalHeight(featureNodes),
    totalHeight(outputNodes),
    0,
  );

  const centeredStartY = (nodes: ProjectAgentCanvasNode[]) => (
    START_Y + Math.max(0, (maxHeight - totalHeight(nodes)) / 2)
  );

  const nextNodes = [
    ...placeColumn(assetNodes, ASSET_X, centeredStartY(assetNodes)),
    ...placeColumn(featureNodes, FEATURE_X, centeredStartY(featureNodes)),
    ...placeColumn(outputNodes, OUTPUT_X, centeredStartY(outputNodes)),
  ];

  return nextNodes.length > 0 ? { ...canvas, nodes: nextNodes } : canvas;
};

export const summarizeProjectAgentCanvas = (canvas: ProjectAgentCanvasState) => {
  const selectedIds = canvas.selectedNodeIds.length > 0
    ? canvas.selectedNodeIds
    : canvas.selectedNodeId
      ? [canvas.selectedNodeId]
      : [];
  const selectedSummary = selectedIds.length > 0 ? selectedIds.join(', ') : 'none';
  const nodeSummary = canvas.nodes.map((node) => {
    const size = getProjectAgentCanvasNodeSize(node);
    const base = `${node.id}:${node.type}@(${Math.round(node.x)},${Math.round(node.y)})/${size.width}x${size.height}`;
    if (isProjectAgentAssetNode(node.type)) {
      return `${base}${node.asset?.id ? ` asset=${node.asset.id}` : ''}`;
    }
    if (isProjectAgentFeatureNode(node.type)) {
      const required = PROJECT_AGENT_FEATURE_INPUTS[node.type].join('+');
      const optional = (PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[node.type] || []).join('+') || 'none';
      const anyOf = (PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[node.type] || []).join('+') || 'none';
      return `${base} required=${required} anyOf=${anyOf} optional=${optional}`;
    }
    return base;
  }).join(' | ') || 'none';
  const edgeSummary = canvas.edges.map((edge) => (
    `${edge.sourceNodeId}->${edge.targetNodeId}[${edge.targetHandle}]`
  )).join(' | ') || 'none';

  return {
    nodeCount: canvas.nodes.length,
    edgeCount: canvas.edges.length,
    selectedNodeIds: selectedIds,
    selectedSummary,
    nodeSummary,
    edgeSummary,
  };
};

export const executeProjectAgentCanvasActions = ({
  canvas: initialCanvas,
  actions,
  detailNodeId = null,
  pendingUiRequest = null,
  selectedAsset = null,
}: ProjectAgentCanvasMutationExecutorOptions): ProjectAgentCanvasMutationExecutorResult => {
  let canvas = initialCanvas;
  let nextDetailNodeId = detailNodeId;
  let nextPendingUiRequest = pendingUiRequest;
  let nextStatusNote = '';
  const aliasMap = new Map<string, string>();

  const resolveNode = (ref: ProjectAgentCanvasNodeRef): ProjectAgentCanvasNode | null => {
    if (ref.kind === 'node_id') {
      return getProjectAgentCanvasNodeById(canvas, ref.nodeId);
    }
    if (ref.kind === 'alias') {
      const mappedId = aliasMap.get(ref.alias);
      return mappedId ? getProjectAgentCanvasNodeById(canvas, mappedId) : null;
    }
    if (ref.kind === 'selected') {
      const selectedId = canvas.selectedNodeIds[0] || canvas.selectedNodeId;
      return selectedId ? getProjectAgentCanvasNodeById(canvas, selectedId) : null;
    }
    if (ref.kind === 'first_of_type') {
      return canvas.nodes.find((node) => node.type === ref.nodeType) || null;
    }
    if (ref.kind === 'asset') {
      return canvas.nodes.find((node) => (
        node.type === ref.assetType &&
        (!ref.assetId || node.asset?.id === ref.assetId)
      )) || null;
    }
    return canvas.nodes.find((node) => node.type === ref.featureType) || null;
  };

  const recordAlias = (alias: string | undefined, nodeId: string) => {
    if (!alias) return;
    aliasMap.set(alias, nodeId);
  };

  actions.forEach((action) => {
    if (isCanvasUiAction(action)) {
      if (action.action.type === 'open_asset_picker') {
        nextPendingUiRequest = action.action.request;
      } else if (action.action.type === 'request_confirmation') {
        nextPendingUiRequest = action.action.request;
      } else if (action.action.type === 'clear_pending_request') {
        nextPendingUiRequest = null;
      } else if (action.action.type === 'set_status_note') {
        nextStatusNote = action.action.message;
      }
      return;
    }

    if (!isCanvasMutationAction(action)) {
      return;
    }

    const mutation = action.mutation;
    switch (mutation.type) {
      case 'add_asset_node': {
        const asset = mutation.useSelectedAsset ? selectedAsset ?? undefined : mutation.asset;
        if (!asset?.id) break;

        const reusedNode = mutation.reuseExisting
          ? findExistingAssetNode(canvas, mutation.assetType, asset)
          : null;
        const targetNode = reusedNode ?? createProjectAgentAssetNode({
          type: mutation.assetType,
          asset,
          ...getResolvedPlacement(canvas, mutation.placement, resolveNode),
        });

        canvas = upsertCanvasNode(canvas, targetNode);
        recordAlias(mutation.alias, targetNode.id);
        if (mutation.select) {
          canvas = {
            ...canvas,
            selectedNodeId: targetNode.id,
            selectedNodeIds: [targetNode.id],
          };
        }
        break;
      }

      case 'add_feature_node': {
        const reusedNode = mutation.reuseExisting
          ? findExistingFeatureNode(canvas, mutation.featureType)
          : null;
        const targetNode = reusedNode ?? createProjectAgentFeatureNode({
          type: mutation.featureType,
          ...getResolvedPlacement(canvas, mutation.placement, resolveNode),
          config: mutation.config ?? undefined,
        });

        const mergedNode = reusedNode && mutation.config
          ? {
              ...targetNode,
              config: {
                ...(targetNode.config || {}),
                ...mutation.config,
              },
            }
          : targetNode;

        canvas = upsertCanvasNode(canvas, mergedNode);
        recordAlias(mutation.alias, mergedNode.id);
        if (mutation.select) {
          canvas = {
            ...canvas,
            selectedNodeId: mergedNode.id,
            selectedNodeIds: [mergedNode.id],
          };
        }
        break;
      }

      case 'add_text_node': {
        const reusedNode = mutation.reuseExisting
          ? canvas.nodes.find((node) => node.type === 'text') || null
          : null;
        const placement = getResolvedPlacement(canvas, mutation.placement, resolveNode);
        const targetNode: ProjectAgentCanvasNode = reusedNode
          ? {
              ...reusedNode,
              label: mutation.label || reusedNode.label,
              asset: {
                ...(reusedNode.asset || { id: reusedNode.id, name: mutation.label || 'Text' }),
                content: mutation.content ?? reusedNode.asset?.content ?? '',
              },
            }
          : {
              id: createProjectAgentCanvasNodeId('text'),
              type: 'text',
              x: placement.x,
              y: placement.y,
              label: mutation.label || 'Text',
              asset: {
                id: createProjectAgentCanvasNodeId('text-asset'),
                name: mutation.label || 'Text',
                content: mutation.content ?? '',
              },
            };

        canvas = upsertCanvasNode(canvas, targetNode);
        recordAlias(mutation.alias, targetNode.id);
        if (mutation.select) {
          canvas = {
            ...canvas,
            selectedNodeId: targetNode.id,
            selectedNodeIds: [targetNode.id],
          };
        }
        break;
      }

      case 'connect_nodes': {
        const sourceNode = resolveNode(mutation.source);
        const targetNode = resolveNode(mutation.target);
        if (!sourceNode || !targetNode) break;

        const edge: ProjectAgentCanvasEdge = {
          id: resolveEdgeId(canvas, sourceNode.id, targetNode.id, mutation.targetHandle),
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          targetHandle: mutation.targetHandle,
        };
        if (getCanvasConnectionError(canvas, edge)) {
          break;
        }
        canvas = connectCanvasNodes(canvas, edge);
        break;
      }

      case 'disconnect_edge': {
        let nextEdgeId = mutation.edgeId || null;
        if (!nextEdgeId && mutation.source && mutation.target && mutation.targetHandle) {
          const sourceNode = resolveNode(mutation.source);
          const targetNode = resolveNode(mutation.target);
          if (!sourceNode || !targetNode) break;
          nextEdgeId = resolveEdgeId(canvas, sourceNode.id, targetNode.id, mutation.targetHandle);
        }
        if (!nextEdgeId) break;
        canvas = removeCanvasEdge(canvas, nextEdgeId);
        break;
      }

      case 'delete_nodes': {
        const targetIds = resolveTargetIds(canvas, mutation.targets, resolveNode);
        targetIds.forEach((targetId) => {
          canvas = removeCanvasNode(canvas, targetId);
          if (nextDetailNodeId === targetId) {
            nextDetailNodeId = null;
          }
        });
        break;
      }

      case 'clear_canvas': {
        canvas = {
          ...DEFAULT_PROJECT_AGENT_CANVAS_STATE,
          viewport: canvas.viewport,
        };
        nextDetailNodeId = null;
        break;
      }

      case 'update_text_content': {
        const targetNode = resolveNode(mutation.target);
        if (!targetNode || targetNode.type !== 'text') break;
        canvas = upsertCanvasNode(canvas, {
          ...targetNode,
          asset: {
            ...(targetNode.asset || { id: targetNode.id, name: targetNode.label || 'Text' }),
            content: mutation.content,
          },
        });
        break;
      }

      case 'update_feature_config': {
        const targetNode = resolveNode(mutation.target);
        if (!targetNode || !isProjectAgentFeatureNode(targetNode.type)) break;
        canvas = upsertCanvasNode(canvas, {
          ...targetNode,
          config: {
            ...(targetNode.config || {}),
            ...mutation.config,
          },
        });
        break;
      }

      case 'select_nodes': {
        const selectedIds = resolveTargetIds(canvas, mutation.targets, resolveNode);
        canvas = {
          ...canvas,
          selectedNodeId: selectedIds[0] || null,
          selectedNodeIds: selectedIds,
        };
        break;
      }

      case 'open_node_details': {
        const targetNode = resolveNode(mutation.target);
        if (!targetNode) break;
        canvas = {
          ...canvas,
          selectedNodeId: targetNode.id,
          selectedNodeIds: [targetNode.id],
        };
        nextDetailNodeId = targetNode.id;
        break;
      }

      case 'format_layout': {
        canvas = formatCanvasNodes(canvas);
        break;
      }
    }
  });

  return {
    canvas,
    detailNodeId: nextDetailNodeId,
    pendingUiRequest: nextPendingUiRequest,
    statusNote: nextStatusNote,
    createdAliases: Object.fromEntries(aliasMap.entries()),
  };
};

export const buildPendingSelectionActions = (
  request: ProjectAgentPendingAssetSelectionRequest,
  selectedAsset: ProjectAgentCanvasAssetRef
): ProjectAgentCanvasAction[] => ([
  {
    kind: 'canvas_mutation',
    mutation: {
      type: 'add_asset_node',
      alias: request.nodeAlias || DEFAULT_ALIAS_FOR_SELECTED_ASSET,
      assetType: request.assetType,
      asset: selectedAsset,
      reuseExisting: true,
      select: true,
    },
  },
  ...request.mutations.map((mutation) => ({
    kind: 'canvas_mutation' as const,
    mutation,
  })),
  {
    kind: 'ui_action',
    action: {
      type: 'clear_pending_request',
    },
  },
]);
