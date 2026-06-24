'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  BrushCleaning,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CopyPlus,
  Coins,
  Download,
  GripVertical,
  Keyboard,
  Loader2,
  Package,
  PawPrint,
  Play,
  Plus,
  RefreshCcw,
  Scissors,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Type,
  User,
  Video as VideoIcon,
  WandSparkles,
} from 'lucide-react';
import { ByteDance, Kling, Qwen } from '@lobehub/icons';
import {
  GENERATION_COSTS,
  SEEDANCE_2_MINI_QUALITY_COSTS,
  SEEDANCE_2_QUALITY_COSTS,
  getGenerationCost,
  getMotionCloneGenerationCost,
  snapDurationToModel,
  type PersistedVideoQuality,
  type VideoModel,
} from '@/lib/constants';
import {
  getProjectAgentCloneGenerationCost,
  normalizeCloneDurationSeconds,
} from '@/lib/video-clone-billing';
import {
  getProjectAgentCanvasNodeSize,
  getProjectAgentAssetDisplayName,
  getProjectAgentFeatureDisplayName,
  isProjectAgentAssetNode,
  isProjectAgentFeatureNode,
  isProjectAgentOutputNode,
  isProjectAgentRuntimeActive,
  PROJECT_AGENT_FEATURE_ANY_OF_INPUTS,
  PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS,
  buildProjectAgentOutputFeedbackPayload,
  getProjectAgentCanvasSourceHandlePosition,
  getProjectAgentCanvasTargetHandlePosition,
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasNode,
  type ProjectAgentCanvasState,
  type ProjectAgentFeedbackType,
  type ProjectAgentFeatureNodeConfig,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import {
  getFeatureStartActionTitle,
  getPendingConnectionPathTarget,
  getProjectAgentFeaturePlaceholderCopy,
  shouldShowFeatureEstimatedCredits,
} from '@/lib/project-agent/canvas-ui';
import { getFeatureNodePresentation } from '@/lib/project-agent/feature-node-presentation';
import { getVideoModelDisplayName } from '@/lib/video-model-display-name';
import {
  getInstructionSemanticPresentation,
  getInstructionSemanticRole,
} from '@/lib/project-agent/instruction-semantics';
import {
  getProjectAgentVideoCloneAllowedModels,
  getProjectAgentVideoCloneDurationSeconds,
  getProjectAgentVideoCloneMode,
  normalizeProjectAgentVideoCloneModel,
} from '@/lib/project-agent/video-clone-mode';
import { buildVideoCloneStartPayload } from '@/lib/project-agent/node-execution';
import {
  getEffectiveProjectAgentVideoModel,
  getProjectAgentVideoModels,
} from '@/lib/project-agent/video-model';
import {
  canChangeProjectAgentVideoQuality,
  getEffectiveProjectAgentVideoQuality,
  getProjectAgentAllowedVideoQualities,
} from '@/lib/project-agent/video-quality';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type CanvasBoardProps = {
  canvas: ProjectAgentCanvasState;
  transientSelectedNodeIds?: string[];
  draggingNodeId?: string | null;
  isPanning: boolean;
  isSelecting?: boolean;
  isSpacePressed: boolean;
  selectionRect?: { x: number; y: number; width: number; height: number } | null;
  pendingConnectionPoint: { x: number; y: number } | null;
  snappedConnectionTarget: {
    targetNodeId: string;
    handle: ProjectAgentAssetNodeType;
    point: { x: number; y: number };
    errorMessage: string | null;
  } | null;
  pendingConnectionSourceId: string | null;
  selectedEdgeId: string | null;
  onCanvasPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onCanvasDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onCanvasDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onNodePointerDown: (event: React.PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onRunFeatureNode: (nodeId: string) => void;
  onRetryFeatureNode: (nodeId: string) => void;
  onRegenerateFeatureNode: (nodeId: string) => void;
  onUpdateFeatureNodeConfig: (nodeId: string, config: Partial<ProjectAgentFeatureNodeConfig>) => void;
  onUpdateAssetNodeMetadata: (nodeId: string, patch: Partial<NonNullable<ProjectAgentCanvasNode['asset']>>) => void;
  onUpdateNodeContent: (nodeId: string, content: string) => void;
  onFormatLayout: () => void;
  onBeginConnection: (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => void;
  onConnectToHandle: (targetNodeId: string, handle: ProjectAgentAssetNodeType) => void;
  onRemoveEdge: (edgeId: string) => void;
  onSelectEdge: (edgeId: string | null) => void;
};

const getNodeSize = (node: ProjectAgentCanvasNode) => getProjectAgentCanvasNodeSize(node);
const getSourceHandlePosition = getProjectAgentCanvasSourceHandlePosition;
const getTargetHandlePosition = (
  node: ProjectAgentCanvasNode,
  _handle?: ProjectAgentAssetNodeType
) => getProjectAgentCanvasTargetHandlePosition(node);

const renderEdgePath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
  const dx = Math.max(60, Math.abs(target.x - source.x) / 2);
  return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;
};

const getBezierMidpoint = (source: { x: number; y: number }, target: { x: number; y: number }) => {
  const dx = Math.max(60, Math.abs(target.x - source.x) / 2);
  const control1 = { x: source.x + dx, y: source.y };
  const control2 = { x: target.x - dx, y: target.y };
  const t = 0.5;
  const mt = 1 - t;

  return {
    x:
      (mt ** 3) * source.x +
      3 * (mt ** 2) * t * control1.x +
      3 * mt * (t ** 2) * control2.x +
      (t ** 3) * target.x,
    y:
      (mt ** 3) * source.y +
      3 * (mt ** 2) * t * control1.y +
      3 * mt * (t ** 2) * control2.y +
      (t ** 3) * target.y,
  };
};

const getBezierTangentAngle = (source: { x: number; y: number }, target: { x: number; y: number }) => {
  const dx = Math.max(60, Math.abs(target.x - source.x) / 2);
  const control1 = { x: source.x + dx, y: source.y };
  const control2 = { x: target.x - dx, y: target.y };
  const t = 0.5;
  const mt = 1 - t;

  const tangentX =
    3 * (mt ** 2) * (control1.x - source.x) +
    6 * mt * t * (control2.x - control1.x) +
    3 * (t ** 2) * (target.x - control2.x);
  const tangentY =
    3 * (mt ** 2) * (control1.y - source.y) +
    6 * mt * t * (control2.y - control1.y) +
    3 * (t ** 2) * (target.y - control2.y);

  return (Math.atan2(tangentY, tangentX) * 180) / Math.PI;
};

function AgentOutputFeedbackButtons({
  asset,
  variant = 'overlay',
}: {
  asset: ProjectAgentCanvasNode['asset'];
  variant?: 'overlay' | 'inline';
}) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState<ProjectAgentFeedbackType | null>(null);
  const [failed, setFailed] = useState(false);

  const submitFeedback = async (feedbackType: ProjectAgentFeedbackType) => {
    const payload = buildProjectAgentOutputFeedbackPayload(asset, feedbackType);
    if (!payload) return;

    setSubmitting(feedbackType);
    setFailed(false);
    try {
      const response = await fetch('/api/projects/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Agent output feedback error:', error);
      setFailed(true);
    } finally {
      setSubmitting(null);
    }
  };

  if (!buildProjectAgentOutputFeedbackPayload(asset, 'positive')) return null;

  if (submitted) {
    if (variant === 'inline') {
      return (
        <span className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-[#0d7a43]">
          Thanks!
        </span>
      );
    }
    return (
      <span className="rounded-full border border-white/70 bg-white/95 px-2.5 py-1.5 text-[10px] font-semibold text-[#4a4944] shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur">
        Thanks!
      </span>
    );
  }

  const buttonClass = variant === 'inline'
    ? 'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#4a4944] transition-colors hover:bg-[#eef7ef] hover:text-[#0d7a43] disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex h-7 items-center gap-1 rounded-full border border-white/70 bg-white/95 px-2.5 text-[10px] font-semibold text-[#3d3c38] shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur transition-colors hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60';

  const failBadge = variant === 'inline'
    ? <span className="px-3.5 py-2 text-xs font-medium text-red-500">Retry</span>
    : <span className="rounded-full border border-white/70 bg-white/95 px-2 py-1 text-[10px] font-medium text-red-500 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur">Retry</span>;

  const failWrap = failed ? failBadge : null;

  if (variant === 'inline') {
    return (
      <>
        {failWrap}
        <button
          type="button"
          className={buttonClass}
          disabled={submitting !== null}
          onClick={(event) => {
            event.stopPropagation();
            void submitFeedback('positive');
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {submitting === 'positive' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
          Good
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={submitting !== null}
          onClick={(event) => {
            event.stopPropagation();
            void submitFeedback('negative');
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {submitting === 'negative' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
          Bad
        </button>
      </>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {failWrap}
      <button
        type="button"
        className={buttonClass}
        disabled={submitting !== null}
        onClick={(event) => {
          event.stopPropagation();
          void submitFeedback('positive');
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {submitting === 'positive' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
        Good
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={submitting !== null}
        onClick={(event) => {
          event.stopPropagation();
          void submitFeedback('negative');
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {submitting === 'negative' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
        Bad
      </button>
    </div>
  );
}

// Returns the tangent angle at an arbitrary canvas point by finding the closest t on the bezier
const getBezierTangentAngleAtPoint = (
  source: { x: number; y: number },
  target: { x: number; y: number },
  pt: { x: number; y: number }
) => {
  const dx = Math.max(60, Math.abs(target.x - source.x) / 2);
  const c1 = { x: source.x + dx, y: source.y };
  const c2 = { x: target.x - dx, y: target.y };

  // Sample 20 points and find the t closest to pt
  let bestT = 0.5;
  let bestDist = Infinity;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const mt = 1 - t;
    const bx = mt ** 3 * source.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * target.x;
    const by = mt ** 3 * source.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * target.y;
    const d = Math.hypot(pt.x - bx, pt.y - by);
    if (d < bestDist) { bestDist = d; bestT = t; }
  }

  const mt = 1 - bestT;
  const tx =
    3 * mt ** 2 * (c1.x - source.x) +
    6 * mt * bestT * (c2.x - c1.x) +
    3 * bestT ** 2 * (target.x - c2.x);
  const ty =
    3 * mt ** 2 * (c1.y - source.y) +
    6 * mt * bestT * (c2.y - c1.y) +
    3 * bestT ** 2 * (target.y - c2.y);

  return (Math.atan2(ty, tx) * 180) / Math.PI;
};

const getAssetFallbackIcon = (type: ProjectAgentAssetNodeType) => {
  if (type === 'avatar') return User;
  if (type === 'product') return Package;
  if (type === 'pet') return PawPrint;
  if (type === 'text') return Type;
  return VideoIcon;
};

const getFeatureIcon = (type: ProjectAgentFeatureNodeType) => {
  if (type === 'video_clone') return CopyPlus;
  if (type === 'avatar_ads') return Sparkles;
  return WandSparkles;
};

const getPlayableVideoUrl = (asset: ProjectAgentCanvasNode['asset']) => {
  const cdnUrl = asset?.videoCdnUrl?.trim();
  if (cdnUrl) return cdnUrl;

  const videoUrl = asset?.videoUrl?.trim();
  return videoUrl || null;
};

const PROJECT_AGENT_VIDEO_CLONE_MODELS = [
  {
    value: 'seedance_2_fast' as const,
    label: 'Seedance 2 Fast',
    Icon: ByteDance,
    creditsPerSecond: GENERATION_COSTS.seedance_2_fast,
  },
  {
    value: 'seedance_2' as const,
    label: 'Seedance 2',
    Icon: ByteDance,
    creditsPerSecond: SEEDANCE_2_QUALITY_COSTS['1080p'],
  },
  {
    value: 'seedance_2_mini' as const,
    label: 'Seedance 2 Mini',
    Icon: ByteDance,
    creditsPerSecond: SEEDANCE_2_MINI_QUALITY_COSTS['720p'],
  },
  {
    value: 'kling_3' as const,
    label: 'Kling 3',
    Icon: Kling,
    creditsPerSecond: GENERATION_COSTS.kling_3,
  },
  {
    value: 'wan_27' as const,
    label: 'Wan 2.7',
    Icon: Qwen,
    creditsPerSecond: GENERATION_COSTS.wan_27,
  },
] satisfies Array<{
  value: NonNullable<ProjectAgentFeatureNodeConfig['videoModel']>;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  creditsPerSecond: number;
}>;

const getFeatureModelOption = (model: ProjectAgentFeatureNodeConfig['videoModel'] | null | undefined) => (
  PROJECT_AGENT_VIDEO_CLONE_MODELS.find((option) => option.value === model) ||
  PROJECT_AGENT_VIDEO_CLONE_MODELS[0]
);

const getConnectedAssetForFeature = (
  canvas: ProjectAgentCanvasState,
  nodeId: string,
  handle: ProjectAgentAssetNodeType
) => {
  const edge = canvas.edges.find((candidate) => (
    candidate.targetNodeId === nodeId &&
    candidate.targetHandle === handle
  ));
  if (!edge) return null;
  return canvas.nodes.find((candidate) => candidate.id === edge.sourceNodeId)?.asset || null;
};

const getFeatureEstimatedCredits = (
  canvas: ProjectAgentCanvasState,
  node: ProjectAgentCanvasNode
) => {
  if (!isProjectAgentFeatureNode(node.type)) return null;

  const runCount = Math.max(1, Number(node.config?.runCount || 1));
  const duration = node.config?.videoDuration || (node.type === 'avatar_ads' ? '16' : '8');

  if (node.type === 'avatar_ads') {
    const model = getEffectiveProjectAgentVideoModel('avatar_ads', node.config?.videoModel);
    const quality = getEffectiveProjectAgentVideoQuality('avatar_ads', model, node.config?.videoQuality);
    return getGenerationCost(model, duration, quality) * runCount;
  }

  if (node.type === 'video_clone') {
    const inputs = {
      avatar: getConnectedAssetForFeature(canvas, node.id, 'avatar'),
      product: getConnectedAssetForFeature(canvas, node.id, 'product'),
      pet: getConnectedAssetForFeature(canvas, node.id, 'pet'),
      video: getConnectedAssetForFeature(canvas, node.id, 'video'),
      text: getConnectedAssetForFeature(canvas, node.id, 'text'),
    };
    if (!inputs.video) {
      return null;
    }
    const mode = getProjectAgentVideoCloneMode(inputs);
    const editVideoDuration = getProjectAgentVideoCloneDurationSeconds(inputs);
    if (mode === 'edit_video' && editVideoDuration === null) {
      return null;
    }
    const payload = buildVideoCloneStartPayload({
      ...inputs,
      video: inputs.video,
      config: node.config,
    });
    return getProjectAgentCloneGenerationCost({
      model: payload.videoModel,
      durationSeconds: payload.videoDuration,
      videoQuality: payload.videoQuality,
      executionMode: payload.executionMode,
      hasReferenceVideoUrl: Boolean(payload.referenceSourceVideoUrl || payload.editVideoSourceUrl),
    }) * runCount;
  }

  const connectedVideo = getConnectedAssetForFeature(canvas, node.id, 'video');
  const durationSeconds = Number(connectedVideo?.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return getMotionCloneGenerationCost(
    durationSeconds,
    node.config?.videoQuality as PersistedVideoQuality | undefined
  ) * runCount;
};

export default function CanvasBoard({
  canvas,
  transientSelectedNodeIds = [],
  draggingNodeId,
  isPanning,
  isSelecting = false,
  isSpacePressed,
  selectionRect,
  pendingConnectionPoint,
  snappedConnectionTarget,
  pendingConnectionSourceId,
  selectedEdgeId,
  onCanvasPointerDown,
  onCanvasWheel,
  onCanvasDrop,
  onCanvasDragOver,
  onNodePointerDown,
  onSelectNode,
  onDeleteNode,
  onNodeDoubleClick,
  onRunFeatureNode,
  onRetryFeatureNode,
  onRegenerateFeatureNode,
  onUpdateFeatureNodeConfig,
  onUpdateAssetNodeMetadata,
  onUpdateNodeContent,
  onFormatLayout,
  onBeginConnection,
  onConnectToHandle,
  onRemoveEdge,
  onSelectEdge,
}: CanvasBoardProps) {
  const shouldReduceMotion = useReducedMotion();
  const pendingSourceNode = pendingConnectionSourceId
    ? canvas.nodes.find((node) => node.id === pendingConnectionSourceId) || null
    : null;
  const shortcutsRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [edgeHoverPoint, setEdgeHoverPoint] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [modelMenuNodeId, setModelMenuNodeId] = useState<string | null>(null);
  const [qualityMenuNodeId, setQualityMenuNodeId] = useState<string | null>(null);

  const getSvgPoint = (event: React.PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelMenuNodeId && !qualityMenuNodeId) return;

    const closeModelMenu = () => {
      setModelMenuNodeId(null);
      setQualityMenuNodeId(null);
    };
    window.addEventListener('click', closeModelMenu);
    return () => {
      window.removeEventListener('click', closeModelMenu);
    };
  }, [modelMenuNodeId, qualityMenuNodeId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (shortcutsRef.current?.contains(target)) return;
      setShortcutsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div
      className={`project-agent-canvas-shell relative h-full w-full overflow-hidden rounded-[30px] ${
        isSelecting ? 'select-none' : ''
      } ${
        isPanning ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab' : 'cursor-default'
      }`}
      onPointerDown={onCanvasPointerDown}
      onWheel={onCanvasWheel}
      onDrop={onCanvasDrop}
      onDragOver={onCanvasDragOver}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${canvas.viewport.x}px, ${canvas.viewport.y}px) scale(${canvas.viewport.zoom})`,
          width: '2400px',
          height: '1800px',
        }}
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          {selectionRect ? (
            <rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(17,17,17,0.06)"
              stroke="#111111"
              strokeDasharray="6 6"
              rx="14"
              ry="14"
            />
          ) : null}
          {canvas.edges.map((edge) => {
            const sourceNode = canvas.nodes.find((node) => node.id === edge.sourceNodeId);
            const targetNode = canvas.nodes.find((node) => node.id === edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;

            const source = getSourceHandlePosition(sourceNode);
            const target = getTargetHandlePosition(targetNode, edge.targetHandle);
            const selected = selectedEdgeId === edge.id;
            const midpoint = getBezierMidpoint(source, target);

            return (
              <g
                key={edge.id}
                onPointerMove={(event) => {
                  const pt = getSvgPoint(event);
                  if (pt) setEdgeHoverPoint({ edgeId: edge.id, x: pt.x, y: pt.y });
                }}
                onPointerEnter={() => {
                  if (hoverTimeoutRef.current) {
                    window.clearTimeout(hoverTimeoutRef.current);
                  }
                  hoverTimeoutRef.current = window.setTimeout(() => {
                    onSelectEdge(edge.id);
                  }, 600);
                }}
                onPointerLeave={() => {
                  if (hoverTimeoutRef.current) {
                    window.clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                  if (selectedEdgeId === edge.id) {
                    onSelectEdge(null);
                  }
                  setEdgeHoverPoint(null);
                }}
              >
                <path
                  d={renderEdgePath(source, target)}
                  fill="none"
                  stroke="#0f0f0f"
                  strokeWidth={3}
                  strokeDasharray={selected ? '8 8' : undefined}
                  opacity={0.95}
                  pointerEvents="stroke"
                  style={{ cursor: 'pointer' }}
                />
                {selected ? (() => {
                  const scissorPt = (edgeHoverPoint?.edgeId === edge.id)
                    ? edgeHoverPoint
                    : midpoint;
                  const angle = getBezierTangentAngleAtPoint(source, target, scissorPt);
                  return (
                    <g
                      transform={`translate(${scissorPt.x}, ${scissorPt.y})`}
                      style={{ cursor: 'pointer' }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        onRemoveEdge(edge.id);
                      }}
                    >
                      <g transform={`rotate(${angle})`}>
                        <circle
                          cx="0"
                          cy="0"
                          r="17"
                          fill="#ffffff"
                          stroke="#d7d4ca"
                          strokeWidth="1.5"
                        />
                        <Scissors
                          className="text-black"
                          height={14}
                          style={{ transform: 'translate(-7px, -7px)' }}
                          width={14}
                          x={0}
                          y={0}
                        />
                      </g>
                    </g>
                  );
                })() : null}
              </g>
            );
          })}
          {pendingConnectionSourceId && pendingConnectionPoint ? (() => {
            const sourceNode = canvas.nodes.find((node) => node.id === pendingConnectionSourceId);
            if (!sourceNode) return null;
            const source = getSourceHandlePosition(sourceNode);
            const target = getPendingConnectionPathTarget(
              pendingConnectionPoint,
              snappedConnectionTarget?.point,
            );
            return (
              <path
                d={renderEdgePath(source, target)}
                fill="none"
                stroke="#000000"
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })() : null}
          {canvas.nodes.map((node) => {
            if (!isProjectAgentOutputNode(node.type)) return null;
            const featureNodeId = node.asset?.id;
            if (!featureNodeId) return null;
            const featureNode = canvas.nodes.find((n) => n.id === featureNodeId);
            if (!featureNode) return null;
            const featureSize = getNodeSize(featureNode);
            const source = {
              x: featureNode.x + featureSize.width,
              y: featureNode.y + featureSize.height / 2,
            };
            const target = {
              x: node.x,
              y: node.y + getNodeSize(node).height / 2,
            };
            return (
              <path
                key={`output-edge-${node.id}`}
                d={renderEdgePath(source, target)}
                fill="none"
                opacity={0.95}
                stroke="#0f0f0f"
                strokeWidth={3}
              />
            );
          })}
        </svg>

        {canvas.nodes.map((node) => {
          const size = getNodeSize(node);
          const selected = transientSelectedNodeIds.includes(node.id) || canvas.selectedNodeIds.includes(node.id);
          const playableVideoUrl = getPlayableVideoUrl(node.asset);
          const isDragging = draggingNodeId === node.id;
          const isFeatureNode = isProjectAgentFeatureNode(node.type);
          const featureType: ProjectAgentFeatureNodeType | null = isFeatureNode
            ? node.type as ProjectAgentFeatureNodeType
            : null;
          const missingInputs = isFeatureNode ? (node.runtime?.missingInputs || []) : [];
          const canStart = isFeatureNode ? Boolean(node.runtime?.canStart) : false;
          const blockedReason = isFeatureNode ? (node.runtime?.blockedReason || null) : null;
          const maintenanceBlocked = isFeatureNode ? Boolean(node.runtime?.maintenanceBlocked) : false;
          const executionState = node.runtime?.executionState || 'invalid';
          const failedState = executionState === 'failed';
          const canRetryFailure = failedState && !maintenanceBlocked;
          const userFacingError = node.runtime?.userFacingError || null;
          const hasReusablePreviousRun = executionState === 'ready' && Boolean(node.runtime?.projectId);
          const insufficientCredits = Boolean(
            userFacingError?.toLowerCase().includes('insufficient credits') ||
            node.runtime?.error?.toLowerCase().includes('insufficient credits')
          );
          const estimatedCredits = isFeatureNode ? getFeatureEstimatedCredits(canvas, node) : null;
          const showRunningState = executionState === 'running' && isProjectAgentRuntimeActive(node.runtime);
          const canChangeModel = isFeatureNode && node.type !== 'motion_clone' && !showRunningState;
          const connectedVideoCloneInputs = isFeatureNode && node.type === 'video_clone'
            ? {
                avatar: getConnectedAssetForFeature(canvas, node.id, 'avatar'),
                product: getConnectedAssetForFeature(canvas, node.id, 'product'),
                pet: getConnectedAssetForFeature(canvas, node.id, 'pet'),
                video: getConnectedAssetForFeature(canvas, node.id, 'video'),
                text: getConnectedAssetForFeature(canvas, node.id, 'text'),
              }
            : null;
          const videoCloneMode = connectedVideoCloneInputs
            ? getProjectAgentVideoCloneMode(connectedVideoCloneInputs)
            : 'clone';
          const selectedVideoModel = node.type === 'video_clone'
            ? normalizeProjectAgentVideoCloneModel(node.config?.videoModel, videoCloneMode)
            : getEffectiveProjectAgentVideoModel(node.type === 'avatar_ads' ? 'avatar_ads' : 'motion_clone', node.config?.videoModel);
          const selectedVideoModelOption = getFeatureModelOption(selectedVideoModel);
          const allowedFeatureModels = node.type === 'video_clone'
            ? getProjectAgentVideoCloneAllowedModels(videoCloneMode)
            : getProjectAgentVideoModels(node.type === 'avatar_ads' ? 'avatar_ads' : 'motion_clone');
          const SelectedVideoModelIcon = selectedVideoModelOption.Icon;
          const modelMenuOpen = modelMenuNodeId === node.id;
          const qualityIntent = node.type === 'video_clone'
            ? 'video_clone'
            : node.type === 'avatar_ads'
              ? 'avatar_ads'
              : 'motion_clone';
          const selectedVideoQuality = (() => {
            if (node.type === 'video_clone' && connectedVideoCloneInputs?.video) {
              return buildVideoCloneStartPayload({
                ...connectedVideoCloneInputs,
                video: connectedVideoCloneInputs.video,
                config: node.config,
              }).videoQuality;
            }

            return getEffectiveProjectAgentVideoQuality(
              qualityIntent,
              selectedVideoModel,
              node.config?.videoQuality,
            );
          })();
          const allowedVideoQualities = getProjectAgentAllowedVideoQualities(
            qualityIntent,
            selectedVideoModel,
          );
          const canChangeQuality = isFeatureNode &&
            !showRunningState &&
            canChangeProjectAgentVideoQuality(qualityIntent, selectedVideoModel);
          const qualityMenuOpen = qualityMenuNodeId === node.id;
          const hasAnyInput = isFeatureNode
            ? canvas.edges.some((e) => e.targetNodeId === node.id)
            : false;
          const hasConnectedVideo = isFeatureNode
            ? Boolean(getConnectedAssetForFeature(canvas, node.id, 'video'))
            : false;
          const showEstimatedCredits = featureType
            ? shouldShowFeatureEstimatedCredits({
                featureType,
                estimatedCredits,
                hasConnectedVideo,
              })
            : false;
          // Receiver dot state: green = ready, yellow = partial, white = empty
          const dotState = canStart ? 'ready' : hasAnyInput ? 'partial' : 'empty';
          const featureOptionalInputs = featureType
            ? (PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[featureType] || [])
            : [];
          const featureAnyOfInputs = featureType
            ? (PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[featureType] || [])
            : [];
          const supportsPendingConnection = (
            isFeatureNode &&
            pendingSourceNode &&
            isProjectAgentAssetNode(pendingSourceNode.type) &&
            (missingInputs.includes(pendingSourceNode.type) ||
             featureOptionalInputs.includes(pendingSourceNode.type) ||
             featureAnyOfInputs.includes(pendingSourceNode.type))
          );
          const FeatureIcon = featureType ? getFeatureIcon(featureType) : null;
          const featurePresentation = featureType ? getFeatureNodePresentation(featureType) : null;
          const instructionPresentation = node.type === 'text'
            ? getInstructionSemanticPresentation(getInstructionSemanticRole(canvas, node.id))
            : null;

          return (
            <div
              key={node.id}
              data-canvas-node="true"
              data-selected={selected ? 'true' : undefined}
              className={`project-agent-node-card group absolute rounded-[24px] border transition-[box-shadow,border-color,transform] ${
                selected
                  ? 'project-agent-node-card--selected'
                  : 'border-[#dfddd5] hover:shadow-[0_22px_48px_rgba(0,0,0,0.10)]'
              } ${isDragging ? 'z-20 select-none shadow-[0_28px_70px_rgba(0,0,0,0.16)]' : modelMenuOpen || qualityMenuOpen ? 'z-[60] shadow-[0_18px_40px_rgba(0,0,0,0.08)]' : 'shadow-[0_18px_40px_rgba(0,0,0,0.08)]'}`}
              style={{
                left: node.x,
                top: node.y,
                width: size.width,
                height: size.height,
              }}
              onPointerDown={(event) => onNodePointerDown(event, node.id)}
              onClick={() => onSelectNode(node.id)}
              onDoubleClick={() => {
                if (!isFeatureNode) {
                  onNodeDoubleClick(node.id);
                }
              }}
              onPointerUp={(event) => {
                if (!supportsPendingConnection || !pendingSourceNode || !isProjectAgentAssetNode(pendingSourceNode.type)) return;
                event.stopPropagation();
                onConnectToHandle(node.id, pendingSourceNode.type);
              }}
            >
              {selected ? (
                <div className="project-agent-node-selection-outline pointer-events-none absolute -inset-1 z-30 rounded-[28px]" />
              ) : null}

              {/* Hover toolbar above card — pb-3 bridges the gap so mouse stays in hover zone */}
              <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full pb-3 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="flex items-center divide-x divide-[#e8e4da] overflow-hidden rounded-full border border-[#ddd7ca] bg-white/96 shadow-[0_10px_24px_rgba(0,0,0,0.11)] backdrop-blur">
                  {isFeatureNode && executionState === 'completed' ? (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-l-full px-3.5 py-2 text-xs font-medium text-[#4a4944] transition-colors hover:bg-[#eef7ef] hover:text-[#0d7a43]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRegenerateFeatureNode(node.id);
                      }}
                      type="button"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                  ) : null}
                  {isProjectAgentOutputNode(node.type) && playableVideoUrl ? (
                    <a
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#4a4944] transition-colors hover:bg-[#f5f2ea] hover:text-black ${
                        !isFeatureNode ? 'rounded-l-full' : ''
                      }`}
                      download
                      href={playableVideoUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  ) : null}
                  {isProjectAgentOutputNode(node.type) ? (
                    <AgentOutputFeedbackButtons asset={node.asset} variant="inline" />
                  ) : null}
                  <button
                    className="inline-flex items-center gap-1.5 rounded-r-full px-3.5 py-2 text-xs font-medium text-[#4a4944] transition-colors hover:bg-[#fff1f0] hover:text-red-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
              {isProjectAgentOutputNode(node.type) ? (
                /* Output video node: 9:16 with HTML5 player */
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1.5">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#c4c1b8] active:cursor-grabbing" strokeWidth={2} />
                    <span className="truncate text-xs font-semibold text-[#3d3c38]">Output</span>
                  </div>
                  <div className="px-2 pb-2">
                    <div
                      className="project-agent-output-video relative w-full overflow-hidden rounded-xl bg-[#111]"
                      style={{ aspectRatio: '9/16' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {playableVideoUrl ? (
                        <video
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          preload="metadata"
                          poster={node.asset?.imageUrl || undefined}
                          src={playableVideoUrl}
                        />
                      ) : node.asset?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt="Output preview"
                          className="h-full w-full object-cover"
                          src={node.asset.imageUrl}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <VideoIcon className="h-7 w-7 text-[#555]" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : isProjectAgentAssetNode(node.type) ? (
                <div className="relative flex flex-col h-full">
                  {/* Header: drag handle + name */}
                  <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#c4c1b8] active:cursor-grabbing" strokeWidth={2} />
                    <span className="truncate text-xs font-semibold text-[#3d3c38]">
                      {instructionPresentation?.label || node.asset?.name || getProjectAgentAssetDisplayName(node.type as ProjectAgentAssetNodeType)}
                    </span>
                  </div>
                  {/* Body */}
                  {node.type === 'text' ? (
                    /* Text node: editable textarea */
                    <div className="flex-1 px-2.5 pb-2.5">
                      <div className="h-full w-full overflow-hidden rounded-[20px] bg-[#f3f1ea]">
                        <textarea
                          className="h-full w-full resize-none bg-transparent p-2.5 text-xs text-[#3d3c38] placeholder:text-[#b0ada5] focus:outline-none focus:ring-0"
                          placeholder={instructionPresentation?.placeholder || 'Write an instruction...'}
                          value={node.asset?.content || ''}
                          onChange={(e) => onUpdateNodeContent(node.id, e.target.value)}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  ) : node.type === 'video' ? (
                    <div className="flex flex-1 items-start justify-center px-2 pb-2">
                      <div
                        className="relative w-full overflow-hidden rounded-xl bg-[#111]"
                        style={{ aspectRatio: '9/16' }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {playableVideoUrl ? (
                          <video
                            className="h-full w-full object-cover"
                            controls
                            playsInline
                            poster={node.asset?.imageUrl || undefined}
                            preload="metadata"
                            src={playableVideoUrl}
                            onLoadedMetadata={(event) => {
                              const durationSeconds = normalizeCloneDurationSeconds(event.currentTarget.duration);
                              if (
                                durationSeconds !== null &&
                                node.asset?.durationSeconds !== durationSeconds
                              ) {
                                onUpdateAssetNodeMetadata(node.id, { durationSeconds });
                              }
                            }}
                          />
                        ) : node.asset?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={node.asset.name}
                            className="h-full w-full object-cover"
                            src={node.asset.imageUrl}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <VideoIcon className="h-7 w-7 text-[#555]" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 2×2 photo grid for avatar/product */
                    <div className="grid grid-cols-2 gap-1 px-2.5 pb-2.5">
                      {(() => {
                        const FallbackIcon = getAssetFallbackIcon(node.type as ProjectAgentAssetNodeType);
                        const photos = (node.asset?.photos?.length
                          ? node.asset.photos
                          : node.asset?.imageUrl
                            ? [node.asset.imageUrl]
                            : []) as string[];
                        return Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center overflow-hidden rounded-xl bg-[#f3f1ea]"
                            style={{ aspectRatio: '1/1' }}
                          >
                            {photos[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt=""
                                className="h-full w-full object-cover"
                                src={photos[i]}
                              />
                            ) : (
                              <FallbackIcon className="h-5 w-5 text-[#b0ada5]" />
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                  {/* Connection button */}
                  <button
                    className={`project-agent-press-icon-button project-agent-node-connection-button absolute right-0 top-1/2 z-40 h-10 w-10 translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border ${
                      selected
                        ? 'project-agent-node-connection-button--selected'
                        : ''
                    } ${
                      pendingConnectionSourceId === node.id
                        ? 'project-agent-press-button--active'
                        : ''
                    }`}
                    onPointerDown={(event) => {
                      onBeginConnection(event, node.id);
                    }}
                    type="button"
                  >
                    <Plus
                      className="pointer-events-none absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2"
                      strokeWidth={3.2}
                    />
                  </button>
                </div>
              ) : (
                /* Feature node — vertical layout matching video/asset cards */
                <div className="relative flex flex-col h-full">
                  {/* Left connection target dot — colored by input state */}
                  <div
                    className={`project-agent-node-status-dot pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_6px_14px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out ${
                      selected
                        ? 'project-agent-node-status-dot--selected z-40'
                        : 'z-10'
                    } ${
                      snappedConnectionTarget?.targetNodeId === node.id
                        ? 'scale-[1.4] border-black bg-white shadow-[0_0_0_8px_rgba(15,15,15,0.10)]'
                        : dotState === 'ready'
                          ? 'border-emerald-400 bg-emerald-50'
                          : dotState === 'partial'
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-[#d7d4ca] bg-white'
                    }`}
                  >
                    <span
                      className={`absolute inset-[3px] rounded-full transition-all duration-300 ease-out ${
                        snappedConnectionTarget?.targetNodeId === node.id
                          ? 'bg-black'
                          : dotState === 'ready'
                            ? 'bg-emerald-400'
                            : dotState === 'partial'
                              ? 'bg-amber-400'
                              : 'bg-white'
                      }`}
                    />
                    {snappedConnectionTarget?.targetNodeId === node.id ? (
                      <span className="absolute inset-[-5px] rounded-full border border-black/15 animate-ping" />
                    ) : null}
                  </div>

                  {/* Header: grip + feature name + start/status button */}
                  <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#c4c1b8] active:cursor-grabbing" strokeWidth={2} />
                    {FeatureIcon ? (
                      <FeatureIcon className="h-4 w-4 shrink-0 text-[#3d3c38]" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#3d3c38]">
                      {getProjectAgentFeatureDisplayName(node.type as ProjectAgentFeatureNodeType)}
                    </span>
                    {userFacingError && !maintenanceBlocked ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500"
                            onClick={(event) => event.stopPropagation()}
                            type="button"
                          >
                            <AlertCircle className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8} className="max-w-[260px] whitespace-normal leading-5">
                          {userFacingError}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    {showRunningState ? (
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-black px-2 py-1 text-[10px] font-semibold text-white">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        Running
                      </div>
                    ) : executionState === 'completed' ? (
                      <div className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Done
                      </div>
                    ) : (
                      <button
                        className={`project-agent-press-button flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                          canRetryFailure || canStart
                            ? 'project-agent-press-button--active cursor-pointer'
                            : maintenanceBlocked
                              ? 'cursor-not-allowed border border-amber-200 bg-amber-50 text-amber-700'
                            : blockedReason
                              ? 'cursor-not-allowed border border-amber-200 bg-amber-50 text-amber-700'
                              : failedState
                                ? 'cursor-not-allowed border border-red-200 bg-red-50 text-red-500'
                                : 'cursor-not-allowed bg-[#f3f1ea] text-[#b8b5ad]'
                        }`}
                        disabled={!canRetryFailure && !canStart}
                        onClick={(event) => {
                          if (canRetryFailure) {
                            event.stopPropagation();
                            onRetryFeatureNode(node.id);
                            return;
                          }
                          if (!canStart) return;
                          event.stopPropagation();
                          onRunFeatureNode(node.id);
                        }}
                        type="button"
                        title={getFeatureStartActionTitle({
                          blockedReason,
                          estimatedCredits: showEstimatedCredits ? estimatedCredits : null,
                        })}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15">
                          {canRetryFailure || insufficientCredits ? (
                            <RefreshCcw className="h-2.5 w-2.5" />
                          ) : canStart ? (
                            <Play className="h-2.5 w-2.5 fill-current" />
                          ) : maintenanceBlocked ? (
                            <AlertTriangle className="h-2.5 w-2.5 text-amber-700" />
                          ) : blockedReason ? (
                            <AlertTriangle className="h-2.5 w-2.5 text-amber-700" />
                          ) : failedState ? (
                            <AlertCircle className="h-2.5 w-2.5 text-red-500" />
                          ) : (
                            <Play className="h-2.5 w-2.5 fill-current" />
                          )}
                        </span>
                        <span>{hasReusablePreviousRun ? 'Run again' : 'Start'}</span>
                        <AnimatePresence initial={false}>
                          {showEstimatedCredits && estimatedCredits !== null ? (
                            <motion.span
                              animate={shouldReduceMotion
                                ? { opacity: 1 }
                                : { opacity: 1, width: 'auto', x: 0 }}
                              className={`flex overflow-hidden items-center gap-1 whitespace-nowrap ${
                            canRetryFailure || canStart
                              ? 'text-white'
                              : maintenanceBlocked || blockedReason
                                ? 'text-amber-700'
                                : failedState
                                  ? 'text-red-500'
                                  : 'text-[#b8b5ad]'
                              }`}
                              exit={shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, width: 0, x: -8 }}
                              initial={shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, width: 0, x: -8 }}
                              transition={shouldReduceMotion
                                ? { duration: 0 }
                                : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                            >
                            <span className={`h-3 w-px ${
                              canRetryFailure || canStart
                                ? 'bg-white/30'
                                : maintenanceBlocked || blockedReason
                                  ? 'bg-amber-300'
                                  : failedState
                                    ? 'bg-red-200'
                                    : 'bg-[#d7d3c8]'
                            }`} />
                            <Coins className="h-2.5 w-2.5" />
                            <span>{estimatedCredits}</span>
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="mx-2.5 h-px bg-[#eeebe3]" />

                  {/* Body: milestone steps or placeholder */}
                  <div className="flex-1 overflow-hidden px-2 py-2">
                    {node.runtime?.milestones?.length ? (
                      <div className="space-y-0.5">
                        {node.runtime.milestones.map((milestone) => {
                          const milestoneState = failedState && milestone.state === 'active'
                            ? 'failed'
                            : milestone.state;
                          const isActive = milestoneState === 'active';
                          const isDone = milestoneState === 'completed';
                          const isFailed = milestoneState === 'failed';
                          return (
                            <div
                              key={milestone.key}
                              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                                isActive ? 'bg-[#f3f1ea]' : ''
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              ) : isActive ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#3d3c38]" />
                              ) : isFailed ? (
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 shrink-0 text-[#d4d1c8]" />
                              )}
                              <span
                                className={`truncate text-xs ${
                                  isActive
                                    ? 'font-medium text-[#1a1a18]'
                                    : isDone
                                      ? 'text-[#9a9992]'
                                      : isFailed
                                        ? 'text-red-500'
                                        : 'text-[#b0ada5]'
                                }`}
                              >
                                {milestone.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-[#f8f7f2] px-3 py-4">
                        {FeatureIcon ? <FeatureIcon className="h-5 w-5 text-[#c8c5bc]" /> : null}
                        <p className="text-center text-[11px] leading-relaxed text-[#b8b5ad]">
                          {getProjectAgentFeaturePlaceholderCopy({
                            featureType: node.type,
                            blockedReason,
                            missingInputs,
                            videoCloneMode: node.type === 'video_clone' ? videoCloneMode : null,
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mx-2.5 border-t border-[#eeebe3] pb-2.5 pt-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2" onClick={(event) => event.stopPropagation()}>
                      <div className="relative">
                      <button
                        aria-expanded={canChangeModel ? modelMenuOpen : undefined}
                        aria-label={`${getProjectAgentFeatureDisplayName(node.type as ProjectAgentFeatureNodeType)} model`}
                        className={`flex h-10 w-full items-center justify-between rounded-[14px] border border-black bg-black px-3 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_10px_20px_rgba(0,0,0,0.16)] ${
                          canChangeModel
                            ? 'cursor-pointer hover:bg-[#151515]'
                            : 'cursor-default'
                        }`}
                        disabled={!canChangeModel}
                        onClick={() => {
                          if (!canChangeModel) return;
                          setQualityMenuNodeId(null);
                          setModelMenuNodeId((current) => current === node.id ? null : node.id);
                        }}
                        type="button"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {node.type !== 'motion_clone' ? (
                            <SelectedVideoModelIcon className="h-4 w-4 shrink-0" />
                          ) : (
                            <Kling className="h-4 w-4 shrink-0 text-white" />
                          )}
                          <span className="truncate">
                            {node.type !== 'motion_clone'
                              ? selectedVideoModelOption.label
                              : getVideoModelDisplayName('kling_3', {
                                  feature: node.type === 'motion_clone' ? 'motion_clone' : 'avatar_ads',
                                })}
                          </span>
                        </span>
                        {canChangeModel ? (
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
                        ) : null}
                      </button>
                      {canChangeModel && modelMenuOpen ? (
                        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full rounded-[14px] border border-[#cfcfcb] bg-[#f1f1ef] p-1.5 shadow-[0_14px_28px_rgba(0,0,0,0.16)]">
                          {PROJECT_AGENT_VIDEO_CLONE_MODELS
                            .filter((option) => allowedFeatureModels.includes(option.value))
                            .map((option) => {
                              const OptionIcon = option.Icon;
                              const active = option.value === selectedVideoModel;
                              return (
                                <Tooltip key={option.value}>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-2 text-left text-[11px] font-semibold transition-colors ${
                                        active ? 'bg-black text-white' : 'text-[#2a2a2a] hover:bg-white'
                                      }`}
                                      onClick={() => {
                                        const normalizedQuality = getEffectiveProjectAgentVideoQuality(
                                          qualityIntent,
                                          option.value,
                                          selectedVideoQuality,
                                        );
                                        onUpdateFeatureNodeConfig(node.id, {
                                          videoModel: option.value,
                                          videoQuality: normalizedQuality,
                                          videoQualityManual: false,
                                          videoDuration: snapDurationToModel(
                                            option.value,
                                            Number(node.config?.videoDuration || (node.type === 'avatar_ads' ? '16' : '8')),
                                          ),
                                        });
                                        setModelMenuNodeId(null);
                                      }}
                                      type="button"
                                    >
                                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                        active ? 'border-white/20 bg-white text-black' : 'border-[#d8d5cc] bg-white text-[#2a2a2a]'
                                      }`}>
                                        <OptionIcon className="h-3.5 w-3.5" />
                                      </span>
                                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                      {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" sideOffset={10}>
                                    {option.creditsPerSecond} credits / sec
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                        </div>
                      ) : null}
                      </div>
                      <div className="relative">
                        <button
                          aria-expanded={canChangeQuality ? qualityMenuOpen : undefined}
                          aria-label={`${getProjectAgentFeatureDisplayName(node.type as ProjectAgentFeatureNodeType)} quality`}
                          className={`flex h-10 w-full items-center justify-between rounded-[14px] border border-black bg-black px-3 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_10px_20px_rgba(0,0,0,0.16)] ${
                            canChangeQuality ? 'cursor-pointer hover:bg-[#151515]' : 'cursor-default opacity-80'
                          }`}
                          disabled={!canChangeQuality}
                          onClick={() => {
                            if (!canChangeQuality) return;
                            setModelMenuNodeId(null);
                            setQualityMenuNodeId((current) => current === node.id ? null : node.id);
                          }}
                          type="button"
                        >
                          <span>{selectedVideoQuality}</span>
                          {canChangeQuality ? (
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${qualityMenuOpen ? 'rotate-180' : ''}`} />
                          ) : null}
                        </button>
                        {canChangeQuality && qualityMenuOpen ? (
                          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-full rounded-[14px] border border-[#cfcfcb] bg-[#f1f1ef] p-1.5 shadow-[0_14px_28px_rgba(0,0,0,0.16)]">
                            {allowedVideoQualities.map((quality) => {
                              const active = quality === selectedVideoQuality;
                              return (
                                <button
                                  key={quality}
                                  className={`flex w-full items-center justify-between rounded-[9px] px-2 py-2 text-left text-[11px] font-semibold transition-colors ${
                                    active ? 'bg-black text-white' : 'text-[#2a2a2a] hover:bg-white'
                                  }`}
                                  onClick={() => {
                                    onUpdateFeatureNodeConfig(node.id, {
                                      videoQuality: quality,
                                      videoQualityManual: true,
                                    });
                                    setQualityMenuNodeId(null);
                                  }}
                                  type="button"
                                >
                                  <span>{quality}</span>
                                  {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {supportsPendingConnection ? (
                    <div className="pointer-events-none absolute left-0 top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0f0f0f] bg-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]" />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div data-canvas-ui="true" className="project-agent-canvas-actions pointer-events-auto absolute left-5 top-5 z-30 flex items-start gap-2 max-[1320px]:left-4 max-[1320px]:top-4 max-[1320px]:gap-1.5 max-[760px]:flex-col">
        <div className="project-agent-canvas-zoom pointer-events-none flex h-10 items-center rounded-full border border-white/70 bg-white/90 px-3.5 text-xs font-medium text-[#55554f] shadow-sm">
          Zoom {Math.round(canvas.viewport.zoom * 100)}%
        </div>
        <div className="relative" data-canvas-ui="true" ref={shortcutsRef}>
          {shortcutsOpen ? (
            <div className="project-agent-card absolute left-0 top-[calc(100%+10px)] w-[300px] rounded-[20px] border p-3 shadow-[0_14px_32px_rgba(0,0,0,0.10)] backdrop-blur">
              <div className="space-y-2.5 text-[11px] leading-relaxed text-[#6a6963]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#4f4e47]">
                  <Keyboard className="h-3.5 w-3.5" />
                  Shortcuts
                </div>
                <div className="rounded-[16px] bg-[#f8f7f2] px-3 py-2.5">
                  <p className="font-medium text-[#4f4e47]">Pan canvas</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Scroll</kbd>
                    <span>vertical</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Shift</kbd>
                    <span>+</span>
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Scroll</kbd>
                    <span>horizontal</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Space</kbd>
                    <span>+</span>
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Drag</kbd>
                    <span>free pan</span>
                  </p>
                </div>
                <div className="rounded-[16px] bg-[#f8f7f2] px-3 py-2.5">
                  <p className="font-medium text-[#4f4e47]">Zoom canvas</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">⌘</kbd>
                    <span>/</span>
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="rounded-md border border-[#d8d4c8] bg-white px-1.5 py-0.5 font-semibold text-[#3f3e38]">Scroll</kbd>
                  </p>
                  <p className="mt-1 text-[#7b7a74]">macOS uses <span className="font-semibold">⌘</span>, Windows uses <span className="font-semibold">Ctrl</span>.</p>
                </div>
              </div>
            </div>
          ) : null}
          <button
            className={`project-agent-canvas-action-button project-agent-press-button flex h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold max-[1320px]:w-10 max-[1320px]:justify-center max-[1320px]:px-0 ${
              shortcutsOpen
                ? 'project-agent-press-button--active'
                : ''
            }`}
            onClick={() => setShortcutsOpen((open) => !open)}
            type="button"
            aria-label="Shortcuts"
            title="Shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span className="project-agent-canvas-action-label max-[1320px]:hidden">Shortcuts</span>
          </button>
        </div>

        <button
          className="project-agent-canvas-action-button project-agent-press-button flex h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold max-[1320px]:w-10 max-[1320px]:justify-center max-[1320px]:px-0"
          onClick={onFormatLayout}
          type="button"
          aria-label="Format"
          title="Format"
        >
          <BrushCleaning className="h-3.5 w-3.5" />
          <span className="project-agent-canvas-action-label max-[1320px]:hidden">Format</span>
        </button>
      </div>
    </div>
  );
}
