'use client';

import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Loader2,
  Package,
  Play,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  User,
  Video as VideoIcon,
  WandSparkles,
} from 'lucide-react';
import {
  getProjectAgentAssetDisplayName,
  getProjectAgentFeatureDisplayName,
  isProjectAgentAssetNode,
  isProjectAgentFeatureNode,
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasNode,
  type ProjectAgentCanvasState,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';

type CanvasBoardProps = {
  canvas: ProjectAgentCanvasState;
  isPanning: boolean;
  isSpacePressed: boolean;
  pendingConnectionPoint: { x: number; y: number } | null;
  snappedConnectionTarget: {
    targetNodeId: string;
    handle: ProjectAgentAssetNodeType;
    point: { x: number; y: number };
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
  onBeginConnection: (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => void;
  onConnectToHandle: (targetNodeId: string, handle: ProjectAgentAssetNodeType) => void;
  onRemoveEdge: (edgeId: string) => void;
  onSelectEdge: (edgeId: string | null) => void;
};

const getNodeSize = (node: ProjectAgentCanvasNode) => {
  if (isProjectAgentAssetNode(node.type)) {
    return { width: 248, height: 96 };
  }
  return { width: 248, height: 96 };
};

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

const getAssetFallbackIcon = (type: ProjectAgentAssetNodeType) => {
  if (type === 'avatar') return User;
  if (type === 'product') return Package;
  return VideoIcon;
};

const getFeatureIcon = (type: ProjectAgentFeatureNodeType) => {
  if (type === 'video_clone') return Clapperboard;
  if (type === 'avatar_ads') return Sparkles;
  return WandSparkles;
};

const formatMissingInputs = (inputs: ProjectAgentAssetNodeType[]) => (
  inputs.map((input) => getProjectAgentAssetDisplayName(input).toLowerCase()).join(', ')
);

export default function CanvasBoard({
  canvas,
  isPanning,
  isSpacePressed,
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
  onBeginConnection,
  onConnectToHandle,
  onRemoveEdge,
  onSelectEdge,
}: CanvasBoardProps) {
  const pendingSourceNode = pendingConnectionSourceId
    ? canvas.nodes.find((node) => node.id === pendingConnectionSourceId) || null
    : null;
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`project-agent-canvas-shell relative h-full w-full overflow-hidden rounded-[30px] ${
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
          {canvas.edges.map((edge) => {
            const sourceNode = canvas.nodes.find((node) => node.id === edge.sourceNodeId);
            const targetNode = canvas.nodes.find((node) => node.id === edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;

            const source = getSourceHandlePosition(sourceNode);
            const target = getTargetHandlePosition(targetNode, edge.targetHandle);
            const selected = selectedEdgeId === edge.id;
            const midpoint = getBezierMidpoint(source, target);
            const tangentAngle = getBezierTangentAngle(source, target);

            return (
              <g
                key={edge.id}
                onPointerEnter={() => {
                  if (hoverTimeoutRef.current) {
                    window.clearTimeout(hoverTimeoutRef.current);
                  }
                  hoverTimeoutRef.current = window.setTimeout(() => {
                    onSelectEdge(edge.id);
                  }, 1000);
                }}
                onPointerLeave={() => {
                  if (hoverTimeoutRef.current) {
                    window.clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                  if (selectedEdgeId === edge.id) {
                    onSelectEdge(null);
                  }
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
                {selected ? (
                  <g
                    transform={`translate(${midpoint.x}, ${midpoint.y})`}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onRemoveEdge(edge.id);
                    }}
                  >
                    <g transform={`rotate(${tangentAngle})`}>
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
                ) : null}
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
        </svg>

        {canvas.nodes.map((node) => {
          const size = getNodeSize(node);
          const selected = canvas.selectedNodeId === node.id;
          const isFeatureNode = isProjectAgentFeatureNode(node.type);
          const featureType: ProjectAgentFeatureNodeType | null = isFeatureNode
            ? node.type as ProjectAgentFeatureNodeType
            : null;
          const missingInputs = isFeatureNode ? (node.runtime?.missingInputs || []) : [];
          const canStart = isFeatureNode ? Boolean(node.runtime?.canStart) : false;
          const executionState = node.runtime?.executionState || 'invalid';
          const supportsPendingConnection = (
            isFeatureNode &&
            pendingSourceNode &&
            isProjectAgentAssetNode(pendingSourceNode.type) &&
            missingInputs.includes(pendingSourceNode.type)
          );
          const FeatureIcon = featureType ? getFeatureIcon(featureType) : null;
          const statusTooltip = (
            executionState === 'completed'
              ? 'Completed'
              : executionState === 'failed'
                ? (node.runtime?.error || 'Failed. Click to retry.')
                : executionState === 'running'
                  ? (node.runtime?.statusLabel || 'Running')
                  : canStart
                    ? 'Start'
                    : `Need ${formatMissingInputs(missingInputs)}`
          );

          return (
            <div
              key={node.id}
              data-canvas-node="true"
              className={`absolute rounded-[24px] border bg-white/96 shadow-[0_18px_40px_rgba(0,0,0,0.08)] transition-shadow ${
                selected
                  ? 'border-black shadow-[0_24px_60px_rgba(0,0,0,0.14)]'
                  : 'border-[#dfddd5] hover:shadow-[0_22px_48px_rgba(0,0,0,0.10)]'
              }`}
              style={{
                left: node.x,
                top: node.y,
                width: size.width,
                minHeight: size.height,
              }}
              onPointerDown={(event) => onNodePointerDown(event, node.id)}
              onClick={() => onSelectNode(node.id)}
              onDoubleClick={() => {
                if (isFeatureNode) {
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
                <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+12px)]">
                  <div className="flex items-center rounded-full border border-[#ddd7ca] bg-white/96 p-1 shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur">
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5e5b54] transition-[transform,background-color,color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#f4efe4] hover:text-black hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:translate-y-0 active:scale-[0.96]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      type="button"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              ) : null}
              {isProjectAgentAssetNode(node.type) ? (
                <div className="relative flex h-full min-h-[96px] items-center gap-4 px-4 py-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f3f1ea]">
                    {node.asset?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={node.asset.name}
                        className="h-full w-full object-cover"
                        src={node.asset.imageUrl}
                      />
                    ) : (
                      (() => {
                        const FallbackIcon = getAssetFallbackIcon(node.type);
                        return <FallbackIcon className="h-5 w-5 text-[#8b8b84]" />;
                      })()
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <p className="truncate text-base font-semibold text-black">
                      {node.asset?.name || 'Untitled'}
                    </p>
                  </div>
                  <button
                    className={`absolute right-0 top-1/2 z-10 h-11 w-11 translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out hover:-translate-y-[52%] hover:scale-[1.04] hover:shadow-[0_16px_30px_rgba(0,0,0,0.14)] active:-translate-y-1/2 active:scale-[0.97] ${
                      pendingConnectionSourceId === node.id
                        ? 'border-black bg-black text-white'
                        : 'border-[#d7d4ca] bg-white text-black'
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
                <div className="relative flex h-full min-h-[96px] items-center gap-4 px-4 py-4">
                  <div
                    className={`pointer-events-none absolute left-0 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white shadow-[0_6px_14px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out ${
                      snappedConnectionTarget?.targetNodeId === node.id
                        ? 'scale-[1.35] border-black shadow-[0_0_0_8px_rgba(15,15,15,0.10)]'
                        : 'border-[#d7d4ca]'
                    }`}
                  >
                    <span
                      className={`absolute inset-[3px] rounded-full transition-all duration-300 ease-out ${
                        snappedConnectionTarget?.targetNodeId === node.id
                          ? 'bg-black'
                          : 'bg-white'
                      }`}
                    />
                    {snappedConnectionTarget?.targetNodeId === node.id ? (
                      <span className="absolute inset-[-5px] rounded-full border border-black/15 animate-ping" />
                    ) : null}
                  </div>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f3f1ea]">
                    {FeatureIcon ? <FeatureIcon className="h-5 w-5 text-[#8b8b84]" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <p className="truncate text-base font-semibold text-black">
                      {getProjectAgentFeatureDisplayName(node.type)}
                    </p>
                  </div>

                  <div className="group absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2">
                    {executionState === 'running' ? (
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-black bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)]"
                        type="button"
                      >
                        <Loader2 className="h-5 w-5 animate-spin transition-transform duration-300 ease-out group-hover:scale-110" />
                      </button>
                    ) : executionState === 'completed' ? (
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-black bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)]"
                        type="button"
                      >
                        <CheckCircle2 className="h-5 w-5 transition-transform duration-300 ease-out group-hover:scale-110" />
                      </button>
                    ) : executionState === 'failed' ? (
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-black bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition-[transform,box-shadow,background-color] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:bg-[#171717] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-95"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRunFeatureNode(node.id);
                        }}
                        title={statusTooltip}
                        type="button"
                      >
                        <AlertCircle className="h-5 w-5 transition-transform duration-300 ease-out group-hover:scale-110" />
                      </button>
                    ) : canStart ? (
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-black bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition-[transform,box-shadow,background-color] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.05] group-hover:bg-[#171717] group-hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-95"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRunFeatureNode(node.id);
                        }}
                        title={statusTooltip}
                        type="button"
                      >
                        <Play className="h-4 w-4 fill-white transition-transform duration-300 ease-out group-hover:scale-110 group-hover:translate-x-[1px]" />
                      </button>
                    ) : (
                      <button
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d7d4ca] bg-white text-[#8c7c4f] shadow-[0_10px_24px_rgba(0,0,0,0.10)] transition-[transform,box-shadow,border-color,color] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:border-[#b8a16a] group-hover:text-[#7f6d43] group-hover:shadow-[0_14px_28px_rgba(0,0,0,0.14)]"
                        type="button"
                      >
                        <AlertCircle className="h-5 w-5 transition-transform duration-300 ease-out group-hover:scale-110" />
                      </button>
                    )}

                    {canStart ? (
                      <div className="pointer-events-none absolute bottom-[calc(100%+10px)] right-1/2 w-max translate-x-1/2 rounded-2xl border border-[#ddd8cb] bg-white px-3 py-2 text-xs font-medium text-[#5f5e57] opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.10)] transition-[opacity,transform] duration-300 ease-out group-hover:translate-x-1/2 group-hover:-translate-y-1 group-hover:opacity-100">
                        Start
                      </div>
                    ) : executionState !== 'running' ? (
                      <div className="pointer-events-none absolute bottom-[calc(100%+10px)] right-1/2 w-max max-w-[220px] translate-x-1/2 rounded-2xl border border-[#ddd8cb] bg-white px-3 py-2 text-xs font-medium text-[#5f5e57] opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.10)] transition-[opacity,transform] duration-300 ease-out group-hover:translate-x-1/2 group-hover:-translate-y-1 group-hover:opacity-100">
                        {statusTooltip}
                      </div>
                    ) : null}
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

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-medium text-[#55554f] shadow-sm">
        Zoom {Math.round(canvas.viewport.zoom * 100)}%
      </div>
    </div>
  );
}
