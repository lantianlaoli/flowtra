export type ProjectAgentFeatureNodeType =
  | 'video_clone'
  | 'avatar_ads'
  | 'motion_clone';

export type ProjectAgentAssetNodeType = 'avatar' | 'product' | 'video' | 'text';

export type ProjectAgentOutputNodeType = 'output_video';

export type ProjectAgentCanvasNodeType =
  | ProjectAgentAssetNodeType
  | ProjectAgentFeatureNodeType
  | ProjectAgentOutputNodeType;

export type ProjectAgentNodeExecutionState =
  | 'idle'
  | 'invalid'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed';

export type ProjectAgentCanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type ProjectAgentCanvasMilestoneState =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed';

export type ProjectAgentCanvasMilestone = {
  key: string;
  label: string;
  state: ProjectAgentCanvasMilestoneState;
};

export type ProjectAgentCanvasAssetRef = {
  id: string;
  name: string;
  imageUrl?: string | null;
  photos?: string[];
  content?: string | null;
  durationSeconds?: number | null;
  sourceType?: 'creator' | 'reference_video' | null;
  videoUrl?: string | null;
  videoCdnUrl?: string | null;
  analysisLanguage?: string | null;
};

export type ProjectAgentFeatureNodeConfig = {
  aspectRatio?: '16:9' | '9:16';
  language?: string;
  videoDuration?: '8' | '16' | '24' | '32';
  videoModel?: 'seedance_2_fast' | 'seedance_2' | 'kling_3';
  videoQuality?: '720p' | '1080p';
};

export type ProjectAgentCanvasNodeRuntime = {
  executionState: ProjectAgentNodeExecutionState;
  projectId?: string | null;
  phase?: string | null;
  progress?: number | null;
  outputUrl?: string | null;
  previewUrl?: string | null;
  error?: string | null;
  userFacingError?: string | null;
  retryable?: boolean;
  statusLabel?: string | null;
  milestones?: ProjectAgentCanvasMilestone[] | null;
  currentMilestoneKey?: string | null;
  missingInputs?: ProjectAgentAssetNodeType[] | null;
  canStart?: boolean;
  blockedReason?: string | null;
  maintenanceBlocked?: boolean;
};

export const isProjectAgentRuntimeActive = (
  runtime: ProjectAgentCanvasNodeRuntime | null | undefined
) => {
  if (!runtime) return false;
  if (runtime.executionState === 'running') return true;
  if (runtime.phase === 'queued') return true;
  return Boolean(runtime.milestones?.some((milestone) => milestone.state === 'active'));
};

export type ProjectAgentCanvasNode = {
  id: string;
  type: ProjectAgentCanvasNodeType;
  x: number;
  y: number;
  label: string;
  asset?: ProjectAgentCanvasAssetRef | null;
  config?: ProjectAgentFeatureNodeConfig | null;
  runtime?: ProjectAgentCanvasNodeRuntime | null;
};

export type ProjectAgentCanvasEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  targetHandle: ProjectAgentAssetNodeType;
};

export const getCanvasConnectionError = (
  state: ProjectAgentCanvasState,
  edge: ProjectAgentCanvasEdge
) => {
  const sourceNode = getProjectAgentCanvasNodeById(state, edge.sourceNodeId);
  const targetNode = getProjectAgentCanvasNodeById(state, edge.targetNodeId);

  if (
    !sourceNode ||
    !targetNode ||
    !isProjectAgentAssetNode(sourceNode.type) ||
    !isProjectAgentFeatureNode(targetNode.type) ||
    sourceNode.type !== edge.targetHandle
  ) {
    return 'This connection is not supported.';
  }

  if (
    !PROJECT_AGENT_FEATURE_INPUTS[targetNode.type].includes(edge.targetHandle) &&
    !(PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[targetNode.type] || []).includes(edge.targetHandle) &&
    !(PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[targetNode.type] || []).includes(edge.targetHandle)
  ) {
    return `This ${sourceNode.type} cannot connect to ${getProjectAgentFeatureDisplayName(targetNode.type)}.`;
  }

  if (
    targetNode.type === 'motion_clone' &&
    edge.targetHandle === 'video' &&
    !sourceNode.asset?.imageUrl
  ) {
    return 'This video needs a cover image before it can connect to Motion Clone.';
  }

  return null;
};

export type ProjectAgentCanvasState = {
  nodes: ProjectAgentCanvasNode[];
  edges: ProjectAgentCanvasEdge[];
  viewport: ProjectAgentCanvasViewport;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  chatDrawerOpen: boolean;
};

export const DEFAULT_PROJECT_AGENT_CANVAS_VIEWPORT: ProjectAgentCanvasViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

export const DEFAULT_PROJECT_AGENT_CANVAS_STATE: ProjectAgentCanvasState = {
  nodes: [],
  edges: [],
  viewport: DEFAULT_PROJECT_AGENT_CANVAS_VIEWPORT,
  selectedNodeId: null,
  selectedNodeIds: [],
  chatDrawerOpen: true,
};

export const getProjectAgentCanvasNodeSize = (node: Pick<ProjectAgentCanvasNode, 'type'>) => {
  if (node.type === 'video') return { width: 168, height: 308 };
  if (isProjectAgentAssetNode(node.type)) return { width: 188, height: 210 };
  if (isProjectAgentOutputNode(node.type)) return { width: 168, height: 308 };
  return { width: 248, height: 216 };
};

export const PROJECT_AGENT_FEATURE_INPUTS: Record<
  ProjectAgentFeatureNodeType,
  ProjectAgentAssetNodeType[]
> = {
  video_clone: ['video'],
  avatar_ads: ['avatar', 'text'],
  motion_clone: ['video'],
};

// "Any one of" input groups — at least one from the group must be connected
export const PROJECT_AGENT_FEATURE_ANY_OF_INPUTS: Partial<Record<
  ProjectAgentFeatureNodeType,
  ProjectAgentAssetNodeType[]
>> = {
  video_clone: ['avatar', 'product'],
  motion_clone: ['avatar', 'product'],
};

// Optional (non-required) inputs for each feature node type
export const PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS: Partial<Record<
  ProjectAgentFeatureNodeType,
  ProjectAgentAssetNodeType[]
>> = {
  video_clone: ['text'],
  avatar_ads: ['product'],
};

export const getProjectAgentFeatureDisplayName = (
  type: ProjectAgentFeatureNodeType
) => {
  switch (type) {
    case 'video_clone':
      return 'Video Clone';
    case 'avatar_ads':
      return 'Avatar Ads';
    case 'motion_clone':
      return 'Motion Clone';
    default:
      return type;
  }
};

export const getProjectAgentAssetDisplayName = (
  type: ProjectAgentAssetNodeType
) => {
  switch (type) {
    case 'avatar':
      return 'Avatar';
    case 'product':
      return 'Product';
    case 'video':
      return 'Video';
    case 'text':
      return 'Text';
    default:
      return type;
  }
};

export const isProjectAgentFeatureNode = (
  type: ProjectAgentCanvasNodeType
): type is ProjectAgentFeatureNodeType => {
  return type === 'video_clone' || type === 'avatar_ads' || type === 'motion_clone';
};

export const isProjectAgentAssetNode = (
  type: ProjectAgentCanvasNodeType
): type is ProjectAgentAssetNodeType => {
  return type === 'avatar' || type === 'product' || type === 'video' || type === 'text';
};

export const isProjectAgentOutputNode = (
  type: ProjectAgentCanvasNodeType
): type is ProjectAgentOutputNodeType => {
  return type === 'output_video';
};

export const createProjectAgentCanvasNodeId = (prefix: string) => (
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`
);

export const createProjectAgentCanvasEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
  targetHandle: ProjectAgentAssetNodeType
) => `${sourceNodeId}:${targetNodeId}:${targetHandle}`;

export const createProjectAgentAssetNode = (input: {
  type: ProjectAgentAssetNodeType;
  x: number;
  y: number;
  asset?: ProjectAgentCanvasAssetRef | null;
}): ProjectAgentCanvasNode => ({
  id: createProjectAgentCanvasNodeId(input.type),
  type: input.type,
  x: input.x,
  y: input.y,
  label: input.asset?.name ?? input.type,
  asset: input.asset ?? null,
  runtime: null,
});

export const createProjectAgentFeatureNode = (input: {
  type: ProjectAgentFeatureNodeType;
  x: number;
  y: number;
  config?: ProjectAgentFeatureNodeConfig;
}): ProjectAgentCanvasNode => ({
  id: createProjectAgentCanvasNodeId(input.type),
  type: input.type,
  x: input.x,
  y: input.y,
  label: getProjectAgentFeatureDisplayName(input.type),
  config: {
    aspectRatio: '9:16',
    language: 'en',
    videoDuration: input.type === 'avatar_ads' ? '16' : '8',
    videoModel: input.type === 'avatar_ads'
      ? 'kling_3'
      : 'kling_3',
    videoQuality: '720p',
    ...input.config,
  },
  runtime: {
    executionState: 'invalid',
    progress: 0,
    phase: 'idle',
  },
});

export const getProjectAgentCanvasNodeById = (
  state: ProjectAgentCanvasState,
  nodeId: string
) => state.nodes.find((node) => node.id === nodeId) || null;

export const getConnectedAssetNodeMap = (
  state: ProjectAgentCanvasState,
  featureNodeId: string
) => {
  const connected = new Map<ProjectAgentAssetNodeType, ProjectAgentCanvasNode>();
  state.edges.forEach((edge) => {
    if (edge.targetNodeId !== featureNodeId) return;
    const sourceNode = getProjectAgentCanvasNodeById(state, edge.sourceNodeId);
    if (!sourceNode || !isProjectAgentAssetNode(sourceNode.type)) return;
    connected.set(edge.targetHandle, sourceNode);
  });
  return connected;
};

export const getMissingFeatureInputs = (
  state: ProjectAgentCanvasState,
  featureNodeId: string
) => {
  const featureNode = getProjectAgentCanvasNodeById(state, featureNodeId);
  if (!featureNode || !isProjectAgentFeatureNode(featureNode.type)) {
    return [] as ProjectAgentAssetNodeType[];
  }

  const connected = getConnectedAssetNodeMap(state, featureNodeId);

  // Strict required inputs — ALL must be connected
  const strictMissing = PROJECT_AGENT_FEATURE_INPUTS[featureNode.type].filter(
    (requiredInput) => !connected.has(requiredInput)
  );

  // "Any of" group — if NONE in the group is connected, the group counts as missing
  const anyOfGroup = PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[featureNode.type];
  const anyOfMissing: ProjectAgentAssetNodeType[] =
    anyOfGroup && !anyOfGroup.some((t) => connected.has(t)) ? anyOfGroup : [];

  return [...strictMissing, ...anyOfMissing];
};

export const formatMissingFeatureInputsLabel = (
  featureType: ProjectAgentFeatureNodeType,
  missingInputs: ProjectAgentAssetNodeType[]
) => {
  if (featureType === 'video_clone' || featureType === 'motion_clone') {
    const needsVideo = missingInputs.includes('video');
    const needsSwapTarget =
      missingInputs.includes('avatar') && missingInputs.includes('product');

    if (needsVideo && needsSwapTarget) {
      return 'video and avatar or product';
    }

    if (needsVideo) {
      return 'video';
    }

    if (needsSwapTarget) {
      return 'avatar or product';
    }
  }

  return missingInputs.join(', ');
};

export const getFeatureStartBlockedReason = (
  state: ProjectAgentCanvasState,
  featureNodeId: string
) => {
  const featureNode = getProjectAgentCanvasNodeById(state, featureNodeId);
  if (!featureNode || !isProjectAgentFeatureNode(featureNode.type)) {
    return null;
  }

  const connected = getConnectedAssetNodeMap(state, featureNodeId);

  if (featureNode.type === 'motion_clone') {
    const videoNode = connected.get('video');
    const durationSeconds = videoNode?.asset?.durationSeconds;

    if (videoNode) {
      if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return 'Reference video duration is unavailable.';
      }

      if (durationSeconds < 3 || durationSeconds > 30) {
        return `Reference video must be 3-30s. Current: ${Math.round(durationSeconds)}s.`;
      }
    }
  }

  return null;
};

export const canRunFeatureNode = (
  state: ProjectAgentCanvasState,
  featureNodeId: string
) => getMissingFeatureInputs(state, featureNodeId).length === 0;

export const upsertCanvasNode = (
  state: ProjectAgentCanvasState,
  node: ProjectAgentCanvasNode
): ProjectAgentCanvasState => {
  const nextNodes = state.nodes.some((item) => item.id === node.id)
    ? state.nodes.map((item) => (item.id === node.id ? node : item))
    : [...state.nodes, node];

  return {
    ...state,
    nodes: nextNodes,
  };
};

export const removeCanvasNode = (
  state: ProjectAgentCanvasState,
  nodeId: string
): ProjectAgentCanvasState => ({
  ...state,
  nodes: state.nodes.filter((node) => node.id !== nodeId),
  edges: state.edges.filter(
    (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
  ),
  selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
  selectedNodeIds: state.selectedNodeIds.filter((selectedId) => selectedId !== nodeId),
});

export const connectCanvasNodes = (
  state: ProjectAgentCanvasState,
  edge: ProjectAgentCanvasEdge
): ProjectAgentCanvasState => {
  if (getCanvasConnectionError(state, edge)) {
    return state;
  }

  const nextEdges = state.edges.filter(
    (item) => !(item.targetNodeId === edge.targetNodeId && item.targetHandle === edge.targetHandle)
  );
  nextEdges.push(edge);

  return {
    ...state,
    edges: nextEdges,
  };
};

export const removeCanvasEdge = (
  state: ProjectAgentCanvasState,
  edgeId: string
): ProjectAgentCanvasState => ({
  ...state,
  edges: state.edges.filter((edge) => edge.id !== edgeId),
});

export const normalizeCanvasState = (
  value: unknown
): ProjectAgentCanvasState => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PROJECT_AGENT_CANVAS_STATE;
  }

  const record = value as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes)
    ? (record.nodes as ProjectAgentCanvasNode[])
    : [];
  const edges = Array.isArray(record.edges)
    ? (record.edges as ProjectAgentCanvasEdge[])
    : [];
  const viewport = record.viewport && typeof record.viewport === 'object'
    ? {
        ...DEFAULT_PROJECT_AGENT_CANVAS_VIEWPORT,
        ...(record.viewport as Partial<ProjectAgentCanvasViewport>),
      }
    : DEFAULT_PROJECT_AGENT_CANVAS_VIEWPORT;

  return {
    nodes,
    edges,
    viewport,
    selectedNodeId: typeof record.selectedNodeId === 'string' ? record.selectedNodeId : null,
    selectedNodeIds: Array.isArray(record.selectedNodeIds)
      ? record.selectedNodeIds.filter((item): item is string => typeof item === 'string')
      : typeof record.selectedNodeId === 'string'
        ? [record.selectedNodeId]
        : [],
    chatDrawerOpen: typeof record.chatDrawerOpen === 'boolean'
      ? record.chatDrawerOpen
      : true,
  };
};
