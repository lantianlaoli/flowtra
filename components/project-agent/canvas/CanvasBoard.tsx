'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BrushCleaning,
  CheckCircle2,
  Circle,
  Clapperboard,
  Download,
  GripVertical,
  Keyboard,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCcw,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  User,
  Video as VideoIcon,
  WandSparkles,
} from 'lucide-react';
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
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasNode,
  type ProjectAgentCanvasState,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import { getProjectAgentFeaturePlaceholderCopy } from '@/lib/project-agent/canvas-ui';
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
  onUpdateNodeContent: (nodeId: string, content: string) => void;
  onFormatLayout: () => void;
  onBeginConnection: (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => void;
  onConnectToHandle: (targetNodeId: string, handle: ProjectAgentAssetNodeType) => void;
  onRemoveEdge: (edgeId: string) => void;
  onSelectEdge: (edgeId: string | null) => void;
};

const getNodeSize = (node: ProjectAgentCanvasNode) => getProjectAgentCanvasNodeSize(node);

const getSourceHandlePosition = (node: ProjectAgentCanvasNode) => {
  const size = getNodeSize(node);
  return {
    x: node.x + size.width,
    y: node.y + size.height / 2,
  };
};

const getTargetHandlePosition = (
  node: ProjectAgentCanvasNode,
  _handle: ProjectAgentAssetNodeType
) => {
  const size = getNodeSize(node);
  return {
    x: node.x,
    y: node.y + size.height / 2,
  };
};

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
  if (type === 'text') return Type;
  return VideoIcon;
};

const getFeatureIcon = (type: ProjectAgentFeatureNodeType) => {
  if (type === 'video_clone') return Clapperboard;
  if (type === 'avatar_ads') return Sparkles;
  return WandSparkles;
};

const getPlayableVideoUrl = (asset: ProjectAgentCanvasNode['asset']) => {
  const cdnUrl = asset?.videoCdnUrl?.trim();
  if (cdnUrl) return cdnUrl;

  const videoUrl = asset?.videoUrl?.trim();
  return videoUrl || null;
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
  onUpdateNodeContent,
  onFormatLayout,
  onBeginConnection,
  onConnectToHandle,
  onRemoveEdge,
  onSelectEdge,
}: CanvasBoardProps) {
  const pendingSourceNode = pendingConnectionSourceId
    ? canvas.nodes.find((node) => node.id === pendingConnectionSourceId) || null
    : null;
  const shortcutsRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [edgeHoverPoint, setEdgeHoverPoint] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
            const target = snappedConnectionTarget?.point || pendingConnectionPoint;
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
          const showRunningState = executionState === 'running' && isProjectAgentRuntimeActive(node.runtime);
          const hasAnyInput = isFeatureNode
            ? canvas.edges.some((e) => e.targetNodeId === node.id)
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

          return (
            <div
              key={node.id}
              data-canvas-node="true"
              data-selected={selected ? 'true' : undefined}
              className={`project-agent-node-card group absolute rounded-[24px] border transition-[box-shadow,border-color,transform] ${
                selected
                  ? 'project-agent-node-card--selected'
                  : 'border-[#dfddd5] hover:shadow-[0_22px_48px_rgba(0,0,0,0.10)]'
              } ${isDragging ? 'z-20 select-none shadow-[0_28px_70px_rgba(0,0,0,0.16)]' : 'shadow-[0_18px_40px_rgba(0,0,0,0.08)]'}`}
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
                      {node.asset?.name || getProjectAgentAssetDisplayName(node.type as ProjectAgentAssetNodeType)}
                    </span>
                  </div>
                  {/* Body */}
                  {node.type === 'text' ? (
                    /* Text node: editable textarea */
                    <div className="flex-1 px-2.5 pb-2.5">
                      <div className="h-full w-full overflow-hidden rounded-[20px] bg-[#f3f1ea]">
                        <textarea
                          className="h-full w-full resize-none bg-transparent p-2.5 text-xs text-[#3d3c38] placeholder:text-[#b0ada5] focus:outline-none focus:ring-0"
                          placeholder="Enter text..."
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
                        className={`project-agent-press-button flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
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
                      >
                        {canRetryFailure ? (
                          <RefreshCcw className="h-2.5 w-2.5" />
                        ) : canStart ? (
                          <Play className="h-2.5 w-2.5 fill-white text-white" />
                        ) : maintenanceBlocked ? (
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-700" />
                        ) : blockedReason ? (
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-700" />
                        ) : failedState ? (
                          <AlertCircle className="h-2.5 w-2.5 text-red-500" />
                        ) : (
                          <Play className="h-2.5 w-2.5 fill-[#b8b5ad] text-[#b8b5ad]" />
                        )}
                        {canRetryFailure ? 'Retry' : maintenanceBlocked ? 'Maintenance' : blockedReason ? 'Warning' : failedState ? 'Failed' : 'Start'}
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
                          })}
                        </p>
                      </div>
                    )}
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

      <div data-canvas-ui="true" className="project-agent-canvas-zoom pointer-events-none absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-medium text-[#55554f] shadow-sm">
        Zoom {Math.round(canvas.viewport.zoom * 100)}%
      </div>

      <div data-canvas-ui="true" className="pointer-events-auto absolute bottom-5 left-5 z-30 flex items-end gap-2 max-[1500px]:gap-1.5">
        <div className="relative" data-canvas-ui="true" ref={shortcutsRef}>
          {shortcutsOpen ? (
            <div className="project-agent-card absolute bottom-[calc(100%+10px)] left-0 w-[300px] rounded-[20px] border p-3 shadow-[0_14px_32px_rgba(0,0,0,0.10)] backdrop-blur">
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
            className={`project-agent-press-button flex h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold max-[1500px]:w-10 max-[1500px]:justify-center max-[1500px]:px-0 ${
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
            <span className="max-[1500px]:hidden">Shortcuts</span>
          </button>
        </div>

        <button
          className="project-agent-press-button flex h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold max-[1500px]:w-10 max-[1500px]:justify-center max-[1500px]:px-0"
          onClick={onFormatLayout}
          type="button"
          aria-label="Format"
          title="Format"
        >
          <BrushCleaning className="h-3.5 w-3.5" />
          <span className="max-[1500px]:hidden">Format</span>
        </button>
      </div>
    </div>
  );
}
