import type { VideoDuration } from '@/lib/constants';

export type ProjectAgentFeatureNodeType =
  | 'video_clone'
  | 'avatar_ads'
  | 'motion_clone';

export type ProjectAgentAssetNodeType = 'avatar' | 'product' | 'video' | 'pet' | 'text';

export type ProjectAgentOutputNodeType = 'output_video';
export type ProjectAgentFeedbackProjectType = 'avatar-ads' | 'video-clone' | 'motion-clone';
export type ProjectAgentFeedbackType = 'positive' | 'negative';

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
  projectId?: string | null;
  projectType?: ProjectAgentFeedbackProjectType | null;
  imageUrl?: string | null;
  photos?: string[];
  content?: string | null;
  durationSeconds?: number | null;
  sourceType?: 'creator' | 'reference_video' | null;
  videoUrl?: string | null;
  videoCdnUrl?: string | null;
  analysisLanguage?: string | null;
  isSystem?: boolean;
  kind?: ProjectAgentAssetNodeType;
};

export type ProjectAgentOutputFeedbackPayload = {
  projectId: string;
  projectType: ProjectAgentFeedbackProjectType;
  feedbackType: ProjectAgentFeedbackType;
};

export const buildProjectAgentOutputFeedbackPayload = (
  asset: ProjectAgentCanvasAssetRef | null | undefined,
  feedbackType: ProjectAgentFeedbackType
): ProjectAgentOutputFeedbackPayload | null => {
  if (!asset?.projectId || !asset.projectType) return null;
  return {
    projectId: asset.projectId,
    projectType: asset.projectType,
    feedbackType,
  };
};

export type ProjectAgentFeatureNodeConfig = {
  aspectRatio?: '16:9' | '9:16';
  language?: string;
  videoDuration?: VideoDuration;
  videoModel?: 'seedance_2_fast' | 'seedance_2' | 'seedance_2_mini' | 'kling_3' | 'wan_27';
  videoQuality?: '480p' | '720p' | '1080p';
  videoQualityManual?: boolean;
  runCount?: 1 | 2 | 3;
};

export type ProjectAgentCanvasRunStatus = {
  executionState: 'ready' | 'running' | 'completed' | 'failed';
  phase: string;
  progress: number;
  outputUrl?: string | null;
  previewUrl?: string | null;
  error?: string | null;
  userFacingError?: string | null;
  retryable: boolean;
  statusLabel: string;
  projectId: string;
  table: 'avatar_ads_projects' | 'video_clone_projects' | 'motion_clone_projects';
  nextAction: string;
  milestones: ProjectAgentCanvasMilestone[];
  currentMilestoneKey: string;
  raw?: Record<string, unknown> | null;
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
  runs?: ProjectAgentCanvasRunStatus[] | null;
};

export const isProjectAgentRuntimeActive = (
  runtime: ProjectAgentCanvasNodeRuntime | null | undefined
) => {
  if (!runtime) return false;
  if (runtime.runs?.some((run) => run.executionState === 'running')) return true;
  if (runtime.milestones?.some((milestone) => milestone.state === 'active')) return true;
  if (runtime.executionState !== 'running') return false;
  if (runtime.phase === 'queued') return true;
  return false;
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

  const occupied = state.edges.some(
    (item) => item.targetNodeId === edge.targetNodeId && item.targetHandle === edge.targetHandle
  );
  if (occupied) {
    return `${getProjectAgentAssetDisplayName(edge.targetHandle)} is already connected. Remove it first.`;
  }

  if (
    !PROJECT_AGENT_FEATURE_INPUTS[targetNode.type].includes(edge.targetHandle) &&
    !(PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[targetNode.type] || []).includes(edge.targetHandle) &&
    !(PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[targetNode.type] || []).includes(edge.targetHandle)
  ) {
    return `This ${sourceNode.type} cannot connect to ${getProjectAgentFeatureDisplayName(targetNode.type)}.`;
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
  return { width: 380, height: 300 };
};

export const getProjectAgentCanvasSourceHandlePosition = (node: Pick<ProjectAgentCanvasNode, 'type' | 'x' | 'y'>) => {
  const size = getProjectAgentCanvasNodeSize(node);
  return {
    x: node.x + size.width,
    y: node.y + size.height / 2,
  };
};

const FEATURE_INPUT_SLOT_GAP = 36;

export const getProjectAgentCanvasTargetHandlePosition = (
  node: Pick<ProjectAgentCanvasNode, 'type' | 'x' | 'y'>,
  handle?: ProjectAgentAssetNodeType
) => {
  const size = getProjectAgentCanvasNodeSize(node);
  if (isProjectAgentFeatureNode(node.type) && handle) {
    const slots = getProjectAgentFeatureInputSlots(node.type);
    const slotIndex = slots.indexOf(handle);
    if (slotIndex >= 0) {
      const firstSlotY = node.y + size.height / 2 - ((slots.length - 1) * FEATURE_INPUT_SLOT_GAP) / 2;
      return {
        x: node.x,
        y: firstSlotY + slotIndex * FEATURE_INPUT_SLOT_GAP,
      };
    }
  }
  return {
    x: node.x,
    y: node.y + size.height / 2,
  };
};

export const PROJECT_AGENT_FEATURE_INPUTS: Record<
  ProjectAgentFeatureNodeType,
  ProjectAgentAssetNodeType[]
> = {
  video_clone: ['video'],
  avatar_ads: ['avatar', 'product'],
  motion_clone: ['video', 'avatar', 'product'],
};

// "Any one of" input groups — at least one from the group must be connected.
export const PROJECT_AGENT_FEATURE_ANY_OF_INPUTS: Partial<Record<
  ProjectAgentFeatureNodeType,
  ProjectAgentAssetNodeType[]
>> = {
  video_clone: ['avatar', 'product', 'pet'],
};

// Optional (non-required) inputs for each feature node type.
// Reserved for future use; current feature nodes use strict inputs only.
export const PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS: Partial<Record<
  ProjectAgentFeatureNodeType,
  ProjectAgentAssetNodeType[]
>> = {};

// Ordered list of input slots shown on the left edge of each feature card.
// Order is the same as PROJECT_AGENT_FEATURE_INPUTS for that feature.
export const getProjectAgentFeatureInputSlots = (
  type: ProjectAgentFeatureNodeType
): ProjectAgentAssetNodeType[] => {
  return Array.from(new Set([
    ...(PROJECT_AGENT_FEATURE_INPUTS[type] ?? []),
    ...(PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[type] ?? []),
    ...(PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[type] ?? []),
  ]));
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

export const getProjectAgentFeedbackProjectType = (
  type: ProjectAgentFeatureNodeType
): ProjectAgentFeedbackProjectType => {
  switch (type) {
    case 'avatar_ads':
      return 'avatar-ads';
    case 'video_clone':
      return 'video-clone';
    case 'motion_clone':
      return 'motion-clone';
    default:
      return 'video-clone';
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
    case 'pet':
      return 'Pet';
    case 'text':
      return 'Instruction';
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
  return type === 'avatar' || type === 'product' || type === 'video' || type === 'pet' || type === 'text';
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
      ? 'seedance_2_fast'
      : input.type === 'video_clone'
        ? 'seedance_2'
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

export const createProjectAgentOutputVideoNode = (input: {
  sourceNode: Pick<ProjectAgentCanvasNode, 'id' | 'type' | 'x' | 'y'>;
  projectId: string;
  outputUrl: string;
  previewUrl?: string | null;
  linkedOutputCount: number;
  existing?: Pick<ProjectAgentCanvasNode, 'x' | 'y'> | null;
}): ProjectAgentCanvasNode => {
  const projectType = isProjectAgentFeatureNode(input.sourceNode.type)
    ? getProjectAgentFeedbackProjectType(input.sourceNode.type)
    : null;

  return {
    id: `output-${input.sourceNode.id}-${input.projectId}`,
    type: 'output_video',
    x: input.existing?.x ?? input.sourceNode.x + 328,
    y: input.existing?.y ?? input.sourceNode.y - 75 + (input.linkedOutputCount * 24),
    label: 'Output',
    asset: {
      id: input.sourceNode.id,
      name: 'Output',
      videoUrl: input.outputUrl,
      imageUrl: input.previewUrl || null,
      projectId: input.projectId,
      projectType,
    },
    runtime: null,
  };
};

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
): ProjectAgentAssetNodeType[] => {
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
  if (featureType === 'video_clone') {
    const needsVideo = missingInputs.includes('video');
    const needsCloneTarget =
      missingInputs.includes('avatar') &&
      missingInputs.includes('product') &&
      missingInputs.includes('pet');

    if (needsVideo && needsCloneTarget) {
      return 'Video and Avatar, Product, or Pet';
    }
    if (needsVideo) {
      return 'Video';
    }
    if (needsCloneTarget) {
      return 'Avatar, Product, or Pet';
    }
  }

  return missingInputs
    .map((type) => getProjectAgentAssetDisplayName(type))
    .join(', ');
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

  if (featureNode.type === 'video_clone') {
    const hasVideo = connected.has('video');
    const hasCloneTarget = connected.has('avatar') || connected.has('product') || connected.has('pet');
    const videoNode = connected.get('video');
    const durationSeconds = videoNode?.asset?.durationSeconds;

    if (hasVideo && !hasCloneTarget) {
      if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return 'Source video duration is unavailable.';
      }

      if (durationSeconds < 2 || durationSeconds > 15) {
        return `Source video must be 2-15s. Current: ${Math.round(durationSeconds)}s.`;
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

  return {
    ...state,
    edges: [...state.edges, edge],
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
