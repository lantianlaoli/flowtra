'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useUser } from '@clerk/nextjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AlertTriangle, ArrowUpRight, History, Loader2, MessageCircle, Plus, Search } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import CreateAvatarModal from '@/components/CreateAvatarModal';
import CreateProductModal from '@/components/CreateProductModal';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import FlowgenThinkingMark from '@/components/ui/FlowgenThinkingMark';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import CanvasBoard from '@/components/project-agent/canvas/CanvasBoard';
import InsertToolbar from '@/components/project-agent/canvas/InsertToolbar';
import NodeDetailsDialog from '@/components/project-agent/canvas/NodeDetailsDialog';
import { useCredits } from '@/contexts/CreditsContext';
import { toProjectAgentVideoAssets } from '@/lib/project-agent/canvas-assets';
import {
  getProjectAgentVisibleMessageText,
  parseProjectAgentMessageParts,
} from '@/lib/project-agent/message-parts';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  DEFAULT_PROJECT_AGENT_CANVAS_STATE,
  PROJECT_AGENT_FEATURE_INPUTS,
  PROJECT_AGENT_FEATURE_ANY_OF_INPUTS,
  PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS,
  connectCanvasNodes,
  createProjectAgentAssetNode,
  createProjectAgentCanvasEdgeId,
  createProjectAgentCanvasNodeId,
  createProjectAgentFeatureNode,
  getProjectAgentCanvasNodeSize,
  getConnectedAssetNodeMap,
  getCanvasConnectionError,
  getFeatureStartBlockedReason,
  formatMissingFeatureInputsLabel,
  getProjectAgentCanvasNodeById,
  isProjectAgentAssetNode,
  isProjectAgentFeatureNode,
  isProjectAgentOutputNode,
  normalizeCanvasState,
  removeCanvasEdge,
  removeCanvasNode,
  upsertCanvasNode,
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasAssetRef,
  type ProjectAgentCanvasNode,
  type ProjectAgentCanvasState,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import {
  normalizeExecutionStatus,
  createQueuedExecutionStatus,
  type ProjectAgentCanvasExecutionStatus,
} from '@/lib/project-agent/node-execution';
import {
  buildPendingSelectionActions,
  executeProjectAgentCanvasActions,
  normalizeProjectAgentPendingUiRequest,
  type ProjectAgentCanvasAction,
  type ProjectAgentSelectableAssetType,
  type ProjectAgentPendingUiRequest,
} from '@/lib/project-agent/canvas-actions';
import type { UserAvatar, UserProduct } from '@/lib/supabase';

type PersistedSessionPayload = {
  session?: {
    state?: Record<string, unknown> | null;
    messages?: UIMessage[];
    updated_at?: string;
  } | null;
};

type HistoryItem = {
  sessionId: string;
  title: string;
  updatedAt: string;
};

type SnappedConnectionTarget = {
  targetNodeId: string;
  handle: ProjectAgentAssetNodeType;
  point: { x: number; y: number };
  errorMessage: string | null;
};

const SESSION_STORAGE_KEY = 'flowtra_project_agent_session_id';
const HISTORY_STORAGE_KEY = 'flowtra_project_agent_history_ids';
const MAX_HISTORY_ITEMS = 8;

const createSessionId = () => {
  try {
    return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
  } catch {
    return `session-${Date.now()}`;
  }
};

const readCurrentSessionId = () => {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
};

const writeCurrentSessionId = (sessionId: string) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
};

const readHistoryIds = () => {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeHistoryIds = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(ids.slice(0, 20)));
};

export const hasVisibleAssistantReplyAfterLatestUserTurn = (messages: UIMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant' && getProjectAgentVisibleMessageText(message).trim().length > 0) {
      return true;
    }
    if (message.role === 'user' && getProjectAgentVisibleMessageText(message).trim().length > 0) {
      return false;
    }
  }
  return false;
};

const buildHistoryTitle = (messages: UIMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === 'user' && getProjectAgentVisibleMessageText(message).trim().length > 0);
  if (!firstUserMessage) return 'New canvas session';
  return getProjectAgentVisibleMessageText(firstUserMessage).trim().slice(0, 80);
};

const toAvatarAssets = (payload: Record<string, unknown>) => {
  const avatars = Array.isArray(payload.avatars) ? payload.avatars : [];
  return avatars
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const primaryUrl = typeof item.primary_photo_url === 'string' ? item.primary_photo_url : typeof item.photo_url === 'string' ? item.photo_url : null;
      const references = Array.isArray(item.reference_photos) ? item.reference_photos : [];
      const refUrls = references
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
        .map((r) => r.photo_url)
        .filter((url): url is string => typeof url === 'string');
      const photos = [primaryUrl, ...refUrls].filter((url): url is string => typeof url === 'string');
      return {
        id: String(item.id),
        name: typeof item.avatar_name === 'string' ? item.avatar_name : typeof item.file_name === 'string' ? item.file_name : 'Avatar',
        imageUrl: primaryUrl,
        photos,
      };
    }) as ProjectAgentCanvasAssetRef[];
};

const toProductAssets = (payload: Record<string, unknown>) => {
  const products = Array.isArray(payload.products) ? payload.products : [];
  return products
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const photos = Array.isArray(item.user_product_photos) ? item.user_product_photos : [];
      const photoUrls = photos
        .filter((photo): photo is Record<string, unknown> => Boolean(photo) && typeof photo === 'object')
        .map((photo) => photo.photo_url)
        .filter((url): url is string => typeof url === 'string');
      return {
        id: String(item.id),
        name: typeof item.product_name === 'string' ? item.product_name : 'Product',
        imageUrl: photoUrls[0] || null,
        photos: photoUrls,
      };
    }) as ProjectAgentCanvasAssetRef[];
};

const toVideoAssets = (payload: Record<string, unknown>) => (
  toProjectAgentVideoAssets(payload.videos) as ProjectAgentCanvasAssetRef[]
);

const getDefaultNodePlacement = (canvas: ProjectAgentCanvasState) => ({
  x: 240 - canvas.viewport.x / canvas.viewport.zoom,
  y: 180 - canvas.viewport.y / canvas.viewport.zoom,
});

const isInteractiveNodeSurface = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'video,button,a,input,textarea,select,summary,[contenteditable="true"],[data-node-interactive="true"]'
    )
  );
};

const setSingleSelectedNode = (current: ProjectAgentCanvasState, nodeId: string | null): ProjectAgentCanvasState => ({
  ...current,
  selectedNodeId: nodeId,
  selectedNodeIds: nodeId ? [nodeId] : [],
});

const isSelectionBoxMeaningful = (width: number, height: number) => width > 6 || height > 6;

export default function ProjectAgentPage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const supabase = useSupabaseBrowserClient();
  const [sessionId, setSessionId] = useState('');
  const [canvas, setCanvas] = useState<ProjectAgentCanvasState>(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  const [draft, setDraft] = useState('');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [statusNote, setStatusNote] = useState('');
  const [pendingUiRequest, setPendingUiRequest] = useState<ProjectAgentPendingUiRequest | null>(null);
  const [appliedCanvasActionCallIds, setAppliedCanvasActionCallIds] = useState<string[]>([]);
  const [toolbarOpenKey, setToolbarOpenKey] = useState<'avatar' | 'product' | 'video' | 'feature' | null>(null);
  const [showCreateAvatarModal, setShowCreateAvatarModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [avatars, setAvatars] = useState<ProjectAgentCanvasAssetRef[]>([]);
  const [products, setProducts] = useState<ProjectAgentCanvasAssetRef[]>([]);
  const [videos, setVideos] = useState<ProjectAgentCanvasAssetRef[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingNodeIds, setDraggingNodeIds] = useState<string[]>([]);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPositions, setDragStartPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [panning, setPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [selectionStartPoint, setSelectionStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectionCurrentPoint, setSelectionCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0, viewportX: 0, viewportY: 0 });
  const [pendingConnectionPoint, setPendingConnectionPoint] = useState<{ x: number; y: number } | null>(null);
  const [snappedConnectionTarget, setSnappedConnectionTarget] = useState<SnappedConnectionTarget | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [pendingConnectionSourceId, setPendingConnectionSourceId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isHistoryPopoverOpen, setIsHistoryPopoverOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<ProjectAgentCanvasState>(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  const historyPopoverRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const persistenceTimeoutRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const previousAwaitingAssistantTurnRef = useRef(false);
  const statusFetchInFlightRef = useRef<Set<string>>(new Set());
  const subscriptionsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const supabaseRef = useRef(supabase);
  const connectionCommittedRef = useRef(false);
  const pendingUiRequestRef = useRef<ProjectAgentPendingUiRequest | null>(null);
  const appliedCanvasActionCallIdsRef = useRef<string[]>([]);
  const processedCanvasToolCallIdsRef = useRef<Set<string>>(new Set());

  const ensureHistoryTracked = useCallback((id: string) => {
    const current = readHistoryIds();
    const next = [id, ...current.filter((item) => item !== id)];
    writeHistoryIds(next);
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!user) {
      setHistoryItems([]);
      return;
    }

    const ids = readHistoryIds().slice(0, MAX_HISTORY_ITEMS);
    if (ids.length === 0) {
      setHistoryItems([]);
      return;
    }

    const loaded = await Promise.all(ids.map(async (id) => {
      try {
        const response = await fetch(`/api/project-agent/session?sessionId=${id}`, { cache: 'no-store' });
        if (!response.ok) return null;
        const payload = await response.json() as PersistedSessionPayload;
        const session = payload.session;
        const sessionMessages = Array.isArray(session?.messages) ? session.messages : [];
        return {
          sessionId: id,
          title: buildHistoryTitle(sessionMessages),
          updatedAt: typeof session?.updated_at === 'string' ? session.updated_at : new Date().toISOString(),
        } as HistoryItem;
      } catch {
        return null;
      }
    }));

    setHistoryItems(loaded.filter((item): item is HistoryItem => Boolean(item)));
  }, [user]);

  useEffect(() => {
    pendingUiRequestRef.current = pendingUiRequest;
  }, [pendingUiRequest]);

  useEffect(() => {
    appliedCanvasActionCallIdsRef.current = appliedCanvasActionCallIds;
    processedCanvasToolCallIdsRef.current = new Set(appliedCanvasActionCallIds);
  }, [appliedCanvasActionCallIds]);

  useEffect(() => {
    if (pendingUiRequest?.type === 'asset_selection') {
      setToolbarOpenKey(pendingUiRequest.assetType);
      return;
    }

    if (!pendingUiRequest) {
      setToolbarOpenKey(null);
    }
  }, [pendingUiRequest]);

  const persistSessionState = useCallback((statePatch: Record<string, unknown>, debounceMs = 0) => {
    if (!sessionId) return;
    if (persistenceTimeoutRef.current) {
      window.clearTimeout(persistenceTimeoutRef.current);
    }
    const persist = () => {
      void fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statePatch,
        }),
      });
    };

    if (debounceMs > 0) {
      persistenceTimeoutRef.current = window.setTimeout(persist, debounceMs);
      return;
    }

    persist();
  }, [sessionId]);

  const updateCanvas = useCallback((updater: ProjectAgentCanvasState | ((current: ProjectAgentCanvasState) => ProjectAgentCanvasState)) => {
    setCanvas((current) => {
      const next = typeof updater === 'function'
        ? (updater as (current: ProjectAgentCanvasState) => ProjectAgentCanvasState)(current)
        : updater;
      canvasRef.current = next;
      persistSessionState({
        canvas: next,
        pendingUiRequest: pendingUiRequestRef.current,
        appliedCanvasActionCallIds: appliedCanvasActionCallIdsRef.current,
      }, 180);
      return next;
    });
  }, [persistSessionState]);

  const resizeComposerInput = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = '0px';
    const nextHeight = Math.min(element.scrollHeight, 220);
    element.style.height = `${Math.max(nextHeight, 48)}px`;
  }, []);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
  } = useChat({
    id: sessionId || undefined,
    transport: new DefaultChatTransport({
      api: '/api/project-agent/chat',
      prepareSendMessagesRequest: ({ id, messages: outgoingMessages }) => ({
        body: {
          id,
          sessionId: id,
          message: outgoingMessages[outgoingMessages.length - 1],
          statePatch: {
            canvas: canvasRef.current,
            pendingUiRequest: pendingUiRequestRef.current,
            appliedCanvasActionCallIds: appliedCanvasActionCallIdsRef.current,
          },
        },
      }),
    }),
    onFinish: () => {
      void refreshHistory();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatusNote(message || 'Chat request failed.');
    },
  });

  const isStreaming = status === 'submitted' || status === 'streaming';

  const loadAssets = useCallback(async () => {
    const [avatarsResponse, assetsResponse] = await Promise.all([
      fetch('/api/user-avatars', { cache: 'no-store' }),
      fetch('/api/assets', { cache: 'no-store' }),
    ]);

    let freshAvatars: ProjectAgentCanvasAssetRef[] = [];
    let freshProducts: ProjectAgentCanvasAssetRef[] = [];
    let freshVideos: ProjectAgentCanvasAssetRef[] = [];

    if (avatarsResponse.ok) {
      const payload = await avatarsResponse.json() as Record<string, unknown>;
      freshAvatars = toAvatarAssets(payload);
      setAvatars(freshAvatars);
    }

    if (assetsResponse.ok) {
      const payload = await assetsResponse.json() as Record<string, unknown>;
      freshProducts = toProductAssets(payload);
      freshVideos = toVideoAssets(payload);
      setProducts(freshProducts);
      setVideos(freshVideos);
    }

    // Sync photos into existing canvas asset nodes so cards show all angles
    const allFresh = [...freshAvatars, ...freshProducts, ...freshVideos];
    if (allFresh.length > 0) {
      updateCanvas((current) => {
        let changed = false;
        const nextNodes = current.nodes.map((node) => {
          if (!isProjectAgentAssetNode(node.type) || !node.asset?.id) return node;
          const fresh = allFresh.find((a) => a.id === node.asset!.id);
          if (!fresh?.photos?.length) return node;
          if (JSON.stringify(node.asset.photos) === JSON.stringify(fresh.photos)) return node;
          changed = true;
          return { ...node, asset: { ...node.asset, photos: fresh.photos } };
        });
        return changed ? { ...current, nodes: nextNodes } : current;
      });
    }
  }, [updateCanvas]);

  const ensureSessionExists = useCallback(async (targetSessionId: string) => {
    await fetch('/api/project-agent/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: targetSessionId,
        statePatch: { canvas: DEFAULT_PROJECT_AGENT_CANVAS_STATE },
      }),
    });
  }, []);

  const fetchSession = useCallback(async (targetSessionId: string) => {
    const response = await fetch(`/api/project-agent/session?sessionId=${targetSessionId}`, { cache: 'no-store' });
    if (response.status === 404) {
      await ensureSessionExists(targetSessionId);
      setCanvas(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
      setPendingUiRequest(null);
      setAppliedCanvasActionCallIds([]);
      setMessages([]);
      return;
    }
    const payload = await response.json() as PersistedSessionPayload;
    const incomingCanvas = normalizeCanvasState(payload.session?.state?.canvas);
    setCanvas(incomingCanvas);
    setPendingUiRequest(normalizeProjectAgentPendingUiRequest(payload.session?.state?.pendingUiRequest));
    setAppliedCanvasActionCallIds(Array.isArray(payload.session?.state?.appliedCanvasActionCallIds)
      ? payload.session?.state?.appliedCanvasActionCallIds.filter((item): item is string => typeof item === 'string').slice(-200)
      : []);
    if (Array.isArray(payload.session?.messages)) {
      setMessages(payload.session.messages);
    } else {
      setMessages([]);
    }
  }, [ensureSessionExists, setMessages]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const nextSessionId = readCurrentSessionId() || createSessionId();
    writeCurrentSessionId(nextSessionId);
    ensureHistoryTracked(nextSessionId);
    setSessionId(nextSessionId);
  }, [ensureHistoryTracked, isLoaded, user]);

  useEffect(() => {
    if (!sessionId || !user) return;
    let cancelled = false;

    const load = async () => {
      setIsPageLoading(true);
      try {
        await Promise.all([
          loadAssets(),
          fetchSession(sessionId),
          refreshHistory(),
        ]);
        if (!cancelled) {
          setSessionReady(true);
        }
      } finally {
        if (!cancelled) {
          setIsPageLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchSession, loadAssets, refreshHistory, sessionId, user]);

  useEffect(() => {
    if (!sessionId || !sessionReady || isStreaming) return;
    if (messages.length === 0) return;
    void fetch('/api/project-agent/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts,
        })),
      }),
    });
  }, [isStreaming, messages, sessionId, sessionReady]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (historyPopoverRef.current?.contains(target)) return;
      setIsHistoryPopoverOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHistoryPopoverOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setCanvas((current) => {
      let changed = false;
      const nextNodes = current.nodes.map((node) => {
        if (!isProjectAgentFeatureNode(node.type)) return node;
        const featureType = node.type;
        const strictMissing = PROJECT_AGENT_FEATURE_INPUTS[featureType].filter((inputType) => {
          const connected = current.edges.some(
            (edge) => edge.targetNodeId === node.id && edge.targetHandle === inputType,
          );
          return !connected;
        });
        const anyOfGroup = PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[featureType];
        const anyOfMissing: ProjectAgentAssetNodeType[] =
          anyOfGroup && !anyOfGroup.some((t) =>
            current.edges.some((e) => e.targetNodeId === node.id && e.targetHandle === t)
          ) ? anyOfGroup : [];
        const missingInputs = [...strictMissing, ...anyOfMissing];
        const blockedReason = getFeatureStartBlockedReason(current, node.id);
        const canStart = missingInputs.length === 0 && !blockedReason;
        const executionState = node.runtime?.executionState;
        const preservedState = executionState === 'running' || executionState === 'completed' || executionState === 'failed';
        const nextState: 'ready' | 'invalid' = canStart ? 'ready' : 'invalid';
        const nextStatusLabel = canStart
          ? 'Ready to start'
          : blockedReason || `Need ${formatMissingFeatureInputsLabel(featureType, missingInputs)}`;
        const runtime = {
          ...(node.runtime || {}),
          missingInputs,
          canStart,
          blockedReason,
          executionState: preservedState ? executionState : nextState,
          statusLabel: preservedState ? node.runtime?.statusLabel : nextStatusLabel,
        };
        if (
          node.runtime?.executionState === runtime.executionState &&
          node.runtime?.statusLabel === runtime.statusLabel &&
          JSON.stringify(node.runtime?.missingInputs || []) === JSON.stringify(missingInputs) &&
          node.runtime?.canStart === canStart &&
          node.runtime?.blockedReason === blockedReason
        ) {
          return node;
        }
        changed = true;
        return {
          ...node,
          runtime,
        };
      });

      if (!changed) return current;
      const next = { ...current, nodes: nextNodes };
      persistSessionState({
        canvas: next,
        pendingUiRequest: pendingUiRequestRef.current,
        appliedCanvasActionCallIds: appliedCanvasActionCallIdsRef.current,
      }, 180);
      return next;
    });
  }, [canvas.edges, canvas.nodes, persistSessionState]);

  const updateNodeRuntime = useCallback((nodeId: string, execution: ProjectAgentCanvasExecutionStatus) => {
    updateCanvas((current) => {
      const node = getProjectAgentCanvasNodeById(current, nodeId);
      if (!node || !isProjectAgentFeatureNode(node.type)) return current;
      const featureType = node.type;
      const strictMissing2 = PROJECT_AGENT_FEATURE_INPUTS[featureType].filter((inputType) => {
        const connected = current.edges.some(
          (edge) => edge.targetNodeId === node.id && edge.targetHandle === inputType,
        );
        return !connected;
      });
      const anyOfGroup2 = PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[featureType];
      const anyOfMissing2: ProjectAgentAssetNodeType[] =
        anyOfGroup2 && !anyOfGroup2.some((t) =>
          current.edges.some((e) => e.targetNodeId === node.id && e.targetHandle === t)
        ) ? anyOfGroup2 : [];
      const missingInputs = [...strictMissing2, ...anyOfMissing2];
      const blockedReason = getFeatureStartBlockedReason(current, node.id);
      let next = upsertCanvasNode(current, {
        ...node,
        runtime: {
          executionState: execution.executionState,
          projectId: execution.projectId,
          phase: execution.phase,
          progress: execution.progress,
          outputUrl: execution.outputUrl || null,
          previewUrl: execution.previewUrl || null,
          error: execution.error || null,
          statusLabel: execution.statusLabel,
          milestones: execution.milestones,
          currentMilestoneKey: execution.currentMilestoneKey,
          missingInputs,
          canStart: missingInputs.length === 0 && !blockedReason,
          blockedReason,
        },
      });

      // When completed with an output URL, append an independent output_video node for this project run.
      if (execution.executionState === 'completed' && execution.outputUrl) {
        const outputNodeId = `output-${nodeId}-${execution.projectId}`;
        const existing = getProjectAgentCanvasNodeById(next, outputNodeId);
        const linkedOutputs = next.nodes.filter((candidate) => (
          isProjectAgentOutputNode(candidate.type) &&
          candidate.asset?.id === nodeId
        ));
        const outputNode = {
          id: outputNodeId,
          type: 'output_video' as const,
          // Preserve position if already placed, otherwise cascade new results under the previous output.
          x: existing?.x ?? node.x + 328,
          y: existing?.y ?? node.y - 75 + (linkedOutputs.length * 24),
          label: 'Output',
          asset: {
            id: nodeId,
            name: 'Output',
            videoUrl: execution.outputUrl,
            imageUrl: execution.previewUrl || null,
          },
        };
        next = upsertCanvasNode(next, outputNode);
      }

      return next;
    });
  }, [updateCanvas]);

  const fetchNodeStatus = useCallback(async (nodeId: string, nodeType: ProjectAgentFeatureNodeType, projectId: string) => {
    const inFlightKey = `${nodeId}:${projectId}`;
    if (statusFetchInFlightRef.current.has(inFlightKey)) return;
    statusFetchInFlightRef.current.add(inFlightKey);

    try {
      const endpoint = nodeType === 'avatar_ads'
        ? `/api/avatar-ads/${projectId}/status`
        : nodeType === 'video_clone'
          ? `/api/competitor-ugc-replication/${projectId}/status`
          : `/api/motion-clone/${projectId}/status`;

      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) return;
      let payload = await response.json() as Record<string, unknown>;
      let execution = normalizeExecutionStatus(nodeType, payload);
      const latestNode = getProjectAgentCanvasNodeById(canvasRef.current, nodeId);
      if (latestNode?.runtime?.projectId !== projectId) {
        return;
      }
      updateNodeRuntime(nodeId, execution);

      if (execution.nextAction !== 'none') {
        const advanceResponse = await fetch('/api/project-agent/canvas-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeType,
            mode: 'advance',
            projectId,
          }),
        });
        if (advanceResponse.ok) {
          const advancePayload = await advanceResponse.json() as { execution?: ProjectAgentCanvasExecutionStatus };
          if (advancePayload.execution) {
            execution = advancePayload.execution;
            const latestNodeAfterAdvance = getProjectAgentCanvasNodeById(canvasRef.current, nodeId);
            if (latestNodeAfterAdvance?.runtime?.projectId !== projectId) {
              return;
            }
            updateNodeRuntime(nodeId, execution);
          }
        }
      }
    } finally {
      statusFetchInFlightRef.current.delete(inFlightKey);
    }
  }, [updateNodeRuntime]);

  useEffect(() => {
    // If the supabase client instance changed (e.g. Clerk auth loaded), clear stale channels
    if (supabaseRef.current !== supabase) {
      subscriptionsRef.current.forEach((channel) => {
        void supabaseRef.current.removeChannel(channel);
      });
      subscriptionsRef.current.clear();
      supabaseRef.current = supabase;
    }

    canvas.nodes.forEach((node) => {
      if (!isProjectAgentFeatureNode(node.type) || !node.runtime?.projectId) return;
      const subscriptionSpecs = node.type === 'avatar_ads'
        ? [{
            key: `avatar_ads_projects:${node.runtime.projectId}`,
            channelName: `project-agent-canvas-avatar_ads_projects:${node.runtime.projectId}`,
            table: 'avatar_ads_projects',
            filter: `id=eq.${node.runtime.projectId}`,
          }]
        : node.type === 'video_clone'
          ? [
              {
                key: `competitor_ugc_replication_projects:${node.runtime.projectId}`,
                channelName: `project-agent-canvas-competitor_ugc_replication_projects:${node.runtime.projectId}`,
                table: 'competitor_ugc_replication_projects',
                filter: `id=eq.${node.runtime.projectId}`,
              },
              {
                key: `competitor_ugc_replication_segments:${node.runtime.projectId}`,
                channelName: `project-agent-canvas-competitor_ugc_replication_segments:${node.runtime.projectId}`,
                table: 'competitor_ugc_replication_segments',
                filter: `project_id=eq.${node.runtime.projectId}`,
              },
            ]
          : [{
              key: `motion_clone_projects:${node.runtime.projectId}`,
              channelName: `project-agent-canvas-motion_clone_projects:${node.runtime.projectId}`,
              table: 'motion_clone_projects',
              filter: `id=eq.${node.runtime.projectId}`,
            }];

      subscriptionSpecs.forEach(({ key, channelName, table, filter }) => {
        if (subscriptionsRef.current.has(key)) return;
        const channel = supabase
          .channel(channelName)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table,
            filter,
          }, () => {
            void fetchNodeStatus(node.id, node.type as ProjectAgentFeatureNodeType, node.runtime?.projectId || '');
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void fetchNodeStatus(node.id, node.type as ProjectAgentFeatureNodeType, node.runtime?.projectId || '');
            }
          });
        subscriptionsRef.current.set(key, channel);
      });
    });

    // Remove channels for nodes that no longer have a projectId
    const activeKeys = new Set(
      canvas.nodes.flatMap((n) => {
        if (!isProjectAgentFeatureNode(n.type) || !n.runtime?.projectId) return [];
        if (n.type === 'avatar_ads') return [`avatar_ads_projects:${n.runtime.projectId}`];
        if (n.type === 'video_clone') {
          return [
            `competitor_ugc_replication_projects:${n.runtime.projectId}`,
            `competitor_ugc_replication_segments:${n.runtime.projectId}`,
          ];
        }
        return [`motion_clone_projects:${n.runtime.projectId}`];
      })
    );
    subscriptionsRef.current.forEach((channel, key) => {
      if (!activeKeys.has(key)) {
        void supabase.removeChannel(channel);
        subscriptionsRef.current.delete(key);
      }
    });
  }, [canvas.nodes, fetchNodeStatus, supabase]);

  useEffect(() => {
    const activeRuntimeNodes = canvas.nodes.filter((node) => (
      isProjectAgentFeatureNode(node.type) &&
      typeof node.runtime?.projectId === 'string' &&
      node.runtime.projectId.length > 0 &&
      node.runtime.executionState === 'running'
    ));

    if (activeRuntimeNodes.length === 0) return;

    const interval = window.setInterval(() => {
      activeRuntimeNodes.forEach((node) => {
        const projectId = node.runtime?.projectId;
        if (!projectId) return;
        void fetchNodeStatus(node.id, node.type as ProjectAgentFeatureNodeType, projectId);
      });
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [canvas.nodes, fetchNodeStatus]);

  useEffect(() => {
    const subscriptions = subscriptionsRef.current;
    const supabaseClient = supabase;

    return () => {
      subscriptions.forEach((channel) => {
        void supabaseClient.removeChannel(channel);
      });
      subscriptions.clear();
    };
  }, [supabase]);

  const getCanvasPointFromClient = useCallback((clientX: number, clientY: number) => {
    const bounds = canvasContainerRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: (clientX - bounds.left - canvas.viewport.x) / canvas.viewport.zoom,
      y: (clientY - bounds.top - canvas.viewport.y) / canvas.viewport.zoom,
    };
  }, [canvas.viewport.x, canvas.viewport.y, canvas.viewport.zoom]);

  const getSnappedConnectionTarget = useCallback((
    sourceNodeId: string,
    point: { x: number; y: number },
  ): SnappedConnectionTarget | null => {
    const sourceNode = getProjectAgentCanvasNodeById(canvas, sourceNodeId);
    if (!sourceNode || !isProjectAgentAssetNode(sourceNode.type)) return null;
    const assetType: ProjectAgentAssetNodeType = sourceNode.type;

    const compatibleNodes = canvas.nodes.filter((node) => (
      isProjectAgentFeatureNode(node.type) &&
      (PROJECT_AGENT_FEATURE_INPUTS[node.type].includes(assetType) ||
       (PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[node.type] || []).includes(assetType) ||
       (PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[node.type] || []).includes(assetType))
    ));

    const bestTarget = compatibleNodes.reduce<{
      targetNodeId: string;
      handle: ProjectAgentAssetNodeType;
      point: { x: number; y: number };
      distance: number;
      errorMessage: string | null;
    } | null>((closest, node) => {
      const targetPoint = {
        x: node.x,
        y: node.y + 108,  // feature node height (216) / 2
      };
      const distance = Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y);
      if (distance > 50) return closest;
      if (!closest || distance < closest.distance) {
        const edge = {
          id: createProjectAgentCanvasEdgeId(sourceNode.id, node.id, assetType),
          sourceNodeId,
          targetNodeId: node.id,
          targetHandle: assetType,
        };
        return {
          targetNodeId: node.id,
          handle: assetType,
          point: targetPoint,
          distance,
          errorMessage: getCanvasConnectionError(canvas, edge),
        };
      }
      return closest;
    }, null);

    if (!bestTarget) return null;
    return {
      targetNodeId: bestTarget.targetNodeId,
      handle: bestTarget.handle,
      point: bestTarget.point,
      errorMessage: bestTarget.errorMessage,
    };
  }, [canvas]);

  const addAssetNode = useCallback((type: ProjectAgentAssetNodeType, asset: ProjectAgentCanvasAssetRef, x?: number, y?: number) => {
    updateCanvas((current) => {
      const placement = getDefaultNodePlacement(current);
      const nextNode = createProjectAgentAssetNode({
        type,
        asset,
        x: x ?? placement.x,
        y: y ?? placement.y,
      });
      return {
        ...upsertCanvasNode(current, nextNode),
        selectedNodeId: nextNode.id,
        selectedNodeIds: [nextNode.id],
      };
    });
  }, [updateCanvas]);

  const addFeatureNode = useCallback((type: ProjectAgentFeatureNodeType, x?: number, y?: number) => {
    updateCanvas((current) => {
      const placement = getDefaultNodePlacement(current);
      const nextNode = createProjectAgentFeatureNode({
        type,
        x: x ?? placement.x,
        y: y ?? placement.y,
      });
      return {
        ...upsertCanvasNode(current, nextNode),
        selectedNodeId: nextNode.id,
        selectedNodeIds: [nextNode.id],
      };
    });
  }, [updateCanvas]);

  const markCanvasToolCallApplied = useCallback((toolCallId: string) => {
    setAppliedCanvasActionCallIds((current) => {
      if (current.includes(toolCallId)) return current;
      const next = [...current, toolCallId].slice(-200);
      appliedCanvasActionCallIdsRef.current = next;
      processedCanvasToolCallIdsRef.current = new Set(next);
      persistSessionState({
        canvas: canvasRef.current,
        pendingUiRequest: pendingUiRequestRef.current,
        appliedCanvasActionCallIds: next,
      });
      return next;
    });
  }, [persistSessionState]);

  const applyCanvasActions = useCallback((actions: ProjectAgentCanvasAction[], selectedAsset?: ProjectAgentCanvasAssetRef | null) => {
    setCanvas((currentCanvas) => {
      const result = executeProjectAgentCanvasActions({
        canvas: currentCanvas,
        actions,
        detailNodeId,
        pendingUiRequest: pendingUiRequestRef.current,
        selectedAsset: selectedAsset ?? null,
      });
      canvasRef.current = result.canvas;
      setDetailNodeId(result.detailNodeId);
      setPendingUiRequest(result.pendingUiRequest);
      persistSessionState({
        canvas: result.canvas,
        pendingUiRequest: result.pendingUiRequest,
        appliedCanvasActionCallIds: appliedCanvasActionCallIdsRef.current,
      }, 180);
      return result.canvas;
    });
  }, [detailNodeId, persistSessionState]);

  useEffect(() => {
    messages.forEach((message) => {
      message.parts.forEach((part) => {
        if (!('type' in part) || typeof part.type !== 'string' || !part.type.startsWith('tool-')) return;
        if (!('state' in part) || part.state !== 'output-available') return;
        if (!('toolCallId' in part) || typeof part.toolCallId !== 'string') return;
        if (!('output' in part) || !part.output || typeof part.output !== 'object') return;
        if (processedCanvasToolCallIdsRef.current.has(part.toolCallId)) return;

        const toolName = part.type.slice('tool-'.length);
        if (!['planCanvasEdit', 'requestAssetSelection', 'confirmDestructiveCanvasAction'].includes(toolName)) return;

        const output = part.output as { actions?: ProjectAgentCanvasAction[] };
        if (Array.isArray(output.actions) && output.actions.length > 0) {
          applyCanvasActions(output.actions);
        }
        markCanvasToolCallApplied(part.toolCallId);
      });
    });
  }, [applyCanvasActions, markCanvasToolCallApplied, messages]);

  const handleToolbarAssetSelect = useCallback((assetType: ProjectAgentSelectableAssetType, asset: ProjectAgentCanvasAssetRef) => {
    if (!pendingUiRequest || pendingUiRequest.type !== 'asset_selection' || pendingUiRequest.assetType !== assetType) {
      return;
    }

    const actions = buildPendingSelectionActions(pendingUiRequest, asset);
    applyCanvasActions(actions, asset);
  }, [applyCanvasActions, pendingUiRequest]);

  const handleQuickUploadRequest = useCallback((assetType: 'avatar' | 'product') => {
    if (assetType === 'avatar') {
      setShowCreateAvatarModal(true);
      return;
    }
    setShowCreateProductModal(true);
  }, []);

  const handleAvatarCreated = useCallback((avatar: UserAvatar) => {
    const createdAsset: ProjectAgentCanvasAssetRef = {
      id: avatar.id,
      name: avatar.avatar_name || avatar.file_name || 'Avatar',
      imageUrl: avatar.primary_photo_url || avatar.photo_url || null,
      photos: [
        avatar.primary_photo_url || avatar.photo_url,
        ...(Array.isArray(avatar.reference_photos) ? avatar.reference_photos.map((photo) => photo.photo_url) : []),
      ].filter((url): url is string => typeof url === 'string'),
    };

    void loadAssets();
    setShowCreateAvatarModal(false);

    if (pendingUiRequest?.type === 'asset_selection' && pendingUiRequest.assetType === 'avatar') {
      handleToolbarAssetSelect('avatar', createdAsset);
      setToolbarOpenKey(null);
    }
  }, [handleToolbarAssetSelect, loadAssets, pendingUiRequest]);

  const handleProductCreated = useCallback((product: UserProduct) => {
    const photoUrls = Array.isArray(product.user_product_photos)
      ? product.user_product_photos.map((photo) => photo.photo_url).filter((url): url is string => typeof url === 'string')
      : [];

    const createdAsset: ProjectAgentCanvasAssetRef = {
      id: product.id,
      name: product.product_name || 'Product',
      imageUrl: photoUrls[0] || null,
      photos: photoUrls,
    };

    void loadAssets();
    setShowCreateProductModal(false);

    if (pendingUiRequest?.type === 'asset_selection' && pendingUiRequest.assetType === 'product') {
      handleToolbarAssetSelect('product', createdAsset);
      setToolbarOpenKey(null);
    }
  }, [handleToolbarAssetSelect, loadAssets, pendingUiRequest]);

  const handleConfirmPendingAction = useCallback(() => {
    if (!pendingUiRequest || pendingUiRequest.type !== 'confirmation') return;
    const actions: ProjectAgentCanvasAction[] = [
      ...pendingUiRequest.mutations.map((mutation) => ({
        kind: 'canvas_mutation' as const,
        mutation,
      })),
      {
        kind: 'ui_action',
        action: {
          type: 'clear_pending_request',
        },
      },
    ];
    applyCanvasActions(actions);
  }, [applyCanvasActions, pendingUiRequest]);

  const handleCancelPendingAction = useCallback(() => {
    setPendingUiRequest(null);
    pendingUiRequestRef.current = null;
    persistSessionState({
      canvas: canvasRef.current,
      pendingUiRequest: null,
      appliedCanvasActionCallIds: appliedCanvasActionCallIdsRef.current,
    });
  }, [persistSessionState]);

  const handleSend = useCallback(async () => {
    if (!sessionId || !draft.trim()) return;
    ensureHistoryTracked(sessionId);
    const text = draft;
    setDraft('');
    setStatusNote('');
    await sendMessage({ text });
  }, [draft, ensureHistoryTracked, sendMessage, sessionId]);

  const handleCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payloadText = event.dataTransfer.getData('application/json');
    if (!payloadText) return;
    const payload = JSON.parse(payloadText) as Record<string, unknown>;
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point) return;
    const { x, y } = point;

    if (payload.kind === 'asset' && typeof payload.type === 'string' && payload.asset && typeof payload.asset === 'object') {
      addAssetNode(payload.type as ProjectAgentAssetNodeType, payload.asset as ProjectAgentCanvasAssetRef, x, y);
    }

    if (payload.kind === 'feature' && typeof payload.featureType === 'string') {
      addFeatureNode(payload.featureType as ProjectAgentFeatureNodeType, x, y);
    }

    if (payload.kind === 'text') {
      updateCanvas((current) => {
        const nodeId = createProjectAgentCanvasNodeId('text');
        const nextNode: ProjectAgentCanvasNode = {
          id: nodeId,
          type: 'text',
          x,
          y,
          label: 'Text',
          asset: { id: nodeId, name: 'Text', content: '' },
        };
        return {
          ...upsertCanvasNode(current, nextNode),
          selectedNodeId: nodeId,
          selectedNodeIds: [nodeId],
        };
      });
    }
  }, [addAssetNode, addFeatureNode, getCanvasPointFromClient, updateCanvas]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    if (isInteractiveNodeSurface(event.target)) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    const node = getProjectAgentCanvasNodeById(canvas, nodeId);
    if (!point || !node) return;
    const nextSelectedIds = canvas.selectedNodeIds.includes(nodeId)
      ? canvas.selectedNodeIds
      : [nodeId];
    dragMovedRef.current = false;
    updateCanvas((current) => ({
      ...current,
      selectedNodeId: nodeId,
      selectedNodeIds: nextSelectedIds,
    }));
    setDraggingNodeId(nodeId);
    setDraggingNodeIds(nextSelectedIds);
    setDragStartPoint(point);
    setDragStartPositions(
      nextSelectedIds.reduce<Record<string, { x: number; y: number }>>((acc, selectedId) => {
        const selectedNode = getProjectAgentCanvasNodeById(canvas, selectedId);
        if (selectedNode) {
          acc[selectedId] = { x: selectedNode.x, y: selectedNode.y };
        }
        return acc;
      }, {})
    );
  }, [canvas, getCanvasPointFromClient, updateCanvas]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = (
        target?.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      );

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditable) {
        const selectedIds = canvas.selectedNodeIds.length > 0
          ? canvas.selectedNodeIds
          : canvas.selectedNodeId
            ? [canvas.selectedNodeId]
            : [];

        if (selectedIds.length > 0) {
          event.preventDefault();
          updateCanvas((current) => selectedIds.reduce((nextState, nodeId) => removeCanvasNode(nextState, nodeId), current));
          setDetailNodeId((current) => (current && selectedIds.includes(current) ? null : current));
          return;
        }
      }

      if (event.code !== 'Space' || isEditable) return;
      event.preventDefault();
      setSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setSpacePressed(false);
      setPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvas.selectedNodeId, canvas.selectedNodeIds, updateCanvas]);

  useEffect(() => {
    resizeComposerInput(composerInputRef.current);
  }, [draft, resizeComposerInput]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (draggingNodeId && dragStartPoint && draggingNodeIds.length > 0 && canvasContainerRef.current) {
        const point = getCanvasPointFromClient(event.clientX, event.clientY);
        if (!point) return;
        const deltaX = point.x - dragStartPoint.x;
        const deltaY = point.y - dragStartPoint.y;
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          dragMovedRef.current = true;
        }
        updateCanvas((current) => {
          let nextState = current;
          draggingNodeIds.forEach((nodeId) => {
            const node = getProjectAgentCanvasNodeById(nextState, nodeId);
            const startPosition = dragStartPositions[nodeId];
            if (!node || !startPosition) return;
            nextState = upsertCanvasNode(nextState, {
              ...node,
              x: startPosition.x + deltaX,
              y: startPosition.y + deltaY,
            });
          });
          return nextState;
        });
      }

      if (selectionStartPoint) {
        const point = getCanvasPointFromClient(event.clientX, event.clientY);
        if (point) {
          if (
            Math.abs(point.x - selectionStartPoint.x) > 1 ||
            Math.abs(point.y - selectionStartPoint.y) > 1
          ) {
            dragMovedRef.current = true;
          }
          setSelectionCurrentPoint(point);
        }
      }

      if (pendingConnectionSourceId) {
        const point = getCanvasPointFromClient(event.clientX, event.clientY);
        if (point) {
          setPendingConnectionPoint(point);
          setSnappedConnectionTarget(getSnappedConnectionTarget(pendingConnectionSourceId, point));
        }
      }

      if (panning) {
        updateCanvas((current) => ({
          ...current,
          viewport: {
            ...current.viewport,
            x: panOrigin.viewportX + (event.clientX - panOrigin.x),
            y: panOrigin.viewportY + (event.clientY - panOrigin.y),
          },
        }));
      }
    };

    const handlePointerUp = () => {
      setDraggingNodeId(null);
      setDraggingNodeIds([]);
      setDragStartPoint(null);
      setDragStartPositions({});
      setPanning(false);
      if (selectionStartPoint && selectionCurrentPoint) {
        const x = Math.min(selectionStartPoint.x, selectionCurrentPoint.x);
        const y = Math.min(selectionStartPoint.y, selectionCurrentPoint.y);
        const width = Math.abs(selectionCurrentPoint.x - selectionStartPoint.x);
        const height = Math.abs(selectionCurrentPoint.y - selectionStartPoint.y);

        if (isSelectionBoxMeaningful(width, height)) {
          updateCanvas((current) => {
            const selectedIds = current.nodes
              .filter((node) => {
                const size = getProjectAgentCanvasNodeSize(node);
                return (
                  node.x < x + width &&
                  node.x + size.width > x &&
                  node.y < y + height &&
                  node.y + size.height > y
                );
              })
              .map((node) => node.id);
            return {
              ...current,
              selectedNodeId: selectedIds[0] || null,
              selectedNodeIds: selectedIds,
            };
          });
        }
      }
      setSelectionStartPoint(null);
      setSelectionCurrentPoint(null);
      if (pendingConnectionSourceId) {
        if (!connectionCommittedRef.current && snappedConnectionTarget) {
          connectionCommittedRef.current = true;
          if (snappedConnectionTarget.errorMessage) {
            setStatusNote(snappedConnectionTarget.errorMessage);
          } else {
            updateCanvas((current) => connectCanvasNodes(current, {
              id: createProjectAgentCanvasEdgeId(
                pendingConnectionSourceId,
                snappedConnectionTarget.targetNodeId,
                snappedConnectionTarget.handle,
              ),
              sourceNodeId: pendingConnectionSourceId,
              targetNodeId: snappedConnectionTarget.targetNodeId,
              targetHandle: snappedConnectionTarget.handle,
            }));
          }
        }
        if (!connectionCommittedRef.current) {
          setPendingConnectionSourceId(null);
          setPendingConnectionPoint(null);
          setSnappedConnectionTarget(null);
        }
      }
      setPendingConnectionSourceId(null);
      setPendingConnectionPoint(null);
      setSnappedConnectionTarget(null);
      connectionCommittedRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragStartPoint, dragStartPositions, draggingNodeId, draggingNodeIds, getCanvasPointFromClient, getSnappedConnectionTarget, panOrigin.viewportX, panOrigin.viewportY, panOrigin.x, panOrigin.y, panning, pendingConnectionSourceId, selectionCurrentPoint, selectionStartPoint, snappedConnectionTarget, updateCanvas]);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-canvas-node="true"], [data-canvas-ui="true"]')) return;
    if (event.button !== 0) return;
    setPendingConnectionSourceId(null);
    setPendingConnectionPoint(null);
    setSnappedConnectionTarget(null);
    setSelectedEdgeId(null);
    setDetailNodeId(null);
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point) return;
    updateCanvas((current) => ({ ...current, selectedNodeId: null, selectedNodeIds: [] }));
    dragMovedRef.current = false;
    if (spacePressed) {
      event.preventDefault();
      setPanning(true);
      setPanOrigin({
        x: event.clientX,
        y: event.clientY,
        viewportX: canvas.viewport.x,
        viewportY: canvas.viewport.y,
      });
    } else {
      setSelectionStartPoint(point);
      setSelectionCurrentPoint(point);
    }
  }, [canvas.viewport.x, canvas.viewport.y, getCanvasPointFromClient, spacePressed, updateCanvas]);

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.metaKey) {
      const nextZoom = Math.min(1.6, Math.max(0.55, canvas.viewport.zoom - event.deltaY * 0.001));
      updateCanvas((current) => ({
        ...current,
        viewport: {
          ...current.viewport,
          zoom: Number(nextZoom.toFixed(2)),
        },
      }));
      return;
    }

    updateCanvas((current) => ({
      ...current,
      viewport: {
        ...current.viewport,
        x: current.viewport.x - (
          event.shiftKey
            ? (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY)
            : event.deltaX
        ),
        y: current.viewport.y - (event.shiftKey ? 0 : event.deltaY),
      },
    }));
  }, [canvas.viewport.zoom, updateCanvas]);

  const handleConnectToHandle = useCallback((targetNodeId: string, handle: ProjectAgentAssetNodeType) => {
    if (!pendingConnectionSourceId) return;
    const edge = {
      id: createProjectAgentCanvasEdgeId(pendingConnectionSourceId, targetNodeId, handle),
      sourceNodeId: pendingConnectionSourceId,
      targetNodeId,
      targetHandle: handle,
    };
    const errorMessage = getCanvasConnectionError(canvas, edge);
    if (errorMessage) {
      connectionCommittedRef.current = true;
      setStatusNote(errorMessage);
      setPendingConnectionSourceId(null);
      setPendingConnectionPoint(null);
      setSnappedConnectionTarget(null);
      return;
    }
    connectionCommittedRef.current = true;
    updateCanvas((current) => connectCanvasNodes(current, edge));
    setStatusNote('');
    setPendingConnectionSourceId(null);
    setPendingConnectionPoint(null);
    setSnappedConnectionTarget(null);
  }, [canvas, pendingConnectionSourceId, updateCanvas]);

  const handleRemoveEdge = useCallback((edgeId: string) => {
    updateCanvas((current) => removeCanvasEdge(current, edgeId));
    setSelectedEdgeId(null);
  }, [updateCanvas]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    updateCanvas((current) => removeCanvasNode(current, nodeId));
    setSelectedEdgeId(null);
    setStatusNote('');
    setDetailNodeId((current) => (current === nodeId ? null : current));
  }, [updateCanvas]);

  const handleUpdateNodeContent = useCallback((nodeId: string, content: string) => {
    updateCanvas((current) => {
      const node = getProjectAgentCanvasNodeById(current, nodeId);
      if (!node) return current;
      return upsertCanvasNode(current, {
        ...node,
        asset: { ...(node.asset || { id: nodeId, name: 'Text' }), content },
      });
    });
  }, [updateCanvas]);

  const handleFormatLayout = useCallback(() => {
    updateCanvas((current) => {
      const ASSET_X = 80;
      const FEATURE_X = 360;
      const OUTPUT_X = 710;
      const START_Y = 80;
      const V_GAP = 40;

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
          y += getNodeHeight(node) + V_GAP;
          return positioned;
        });
      };

      const assetNodes = current.nodes.filter((n) => isProjectAgentAssetNode(n.type));
      const featureNodes = current.nodes.filter((n) => isProjectAgentFeatureNode(n.type));
      const outputNodes = current.nodes.filter((n) => isProjectAgentOutputNode(n.type));

      const totalHeight = (nodes: ProjectAgentCanvasNode[]) =>
        nodes.reduce((sum, n, i) => sum + getNodeHeight(n) + (i < nodes.length - 1 ? V_GAP : 0), 0);

      const maxH = Math.max(totalHeight(assetNodes), totalHeight(featureNodes), totalHeight(outputNodes), 0);

      const centeredStartY = (nodes: ProjectAgentCanvasNode[]) =>
        START_Y + Math.max(0, (maxH - totalHeight(nodes)) / 2);

      const positionedNodes = [
        ...placeColumn(assetNodes, ASSET_X, centeredStartY(assetNodes)),
        ...placeColumn(featureNodes, FEATURE_X, centeredStartY(featureNodes)),
        ...placeColumn(outputNodes, OUTPUT_X, centeredStartY(outputNodes)),
      ];

      if (positionedNodes.length === 0) return current;
      return { ...current, nodes: positionedNodes };
    });
  }, [updateCanvas]);

  const handleBeginConnection = useCallback((event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceNode = getProjectAgentCanvasNodeById(canvas, nodeId);
    if (!sourceNode || !isProjectAgentAssetNode(sourceNode.type)) {
      setPendingConnectionSourceId(null);
      setPendingConnectionPoint(null);
      setSnappedConnectionTarget(null);
      return;
    }
    const assetType: ProjectAgentAssetNodeType = sourceNode.type;

    const hasConnectableFeature = canvas.nodes.some((node) => (
      isProjectAgentFeatureNode(node.type) &&
      (PROJECT_AGENT_FEATURE_INPUTS[node.type].includes(assetType) ||
       (PROJECT_AGENT_FEATURE_ANY_OF_INPUTS[node.type] || []).includes(assetType) ||
       (PROJECT_AGENT_FEATURE_OPTIONAL_INPUTS[node.type] || []).includes(assetType))
    ));

    if (!hasConnectableFeature) {
      setPendingConnectionSourceId(null);
      setPendingConnectionPoint(null);
      setSnappedConnectionTarget(null);
      setStatusNote(`Add a compatible feature node before connecting this ${assetType}.`);
      return;
    }

    connectionCommittedRef.current = false;
    setStatusNote('');
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    setPendingConnectionSourceId(nodeId);
    setPendingConnectionPoint(point);
    setSnappedConnectionTarget(point ? getSnappedConnectionTarget(nodeId, point) : null);
  }, [canvas, getCanvasPointFromClient, getSnappedConnectionTarget]);

  const handleRunNode = useCallback(async (nodeId: string) => {
    const node = getProjectAgentCanvasNodeById(canvas, nodeId);
    if (!node || !isProjectAgentFeatureNode(node.type)) return;
    const inputs = getConnectedAssetNodeMap(canvas, nodeId);

    updateCanvas((current) => {
      const nextNode = getProjectAgentCanvasNodeById(current, nodeId);
      if (!nextNode || !isProjectAgentFeatureNode(nextNode.type)) return current;
      return upsertCanvasNode(current, {
        ...nextNode,
        runtime: {
          executionState: 'running',
          projectId: null,
          outputUrl: null,
          previewUrl: null,
          ...createQueuedExecutionStatus(nextNode.type),
          error: null,
          canStart: true,
          missingInputs: [],
        },
      });
    });

    const response = await fetch('/api/project-agent/canvas-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeType: node.type,
        mode: 'start',
        config: node.config,
        connectedAssets: {
          avatar: inputs.get('avatar')?.asset || null,
          product: inputs.get('product')?.asset || null,
          video: inputs.get('video')?.asset || null,
          text: inputs.get('text')?.asset || null,
        },
      }),
    });

    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      execution?: ProjectAgentCanvasExecutionStatus;
    };

    if (!response.ok || !payload.execution) {
      updateCanvas((current) => {
        const nextNode = getProjectAgentCanvasNodeById(current, nodeId);
        if (!nextNode) return current;
        return upsertCanvasNode(current, {
          ...nextNode,
          runtime: {
            ...(nextNode.runtime || {}),
            executionState: 'failed',
            statusLabel: 'Failed',
            error: payload.error || 'Run failed.',
          },
        });
      });
      return;
    }

    updateNodeRuntime(nodeId, payload.execution);
  }, [canvas, updateCanvas, updateNodeRuntime]);

  const handleRegenerateFeatureNode = useCallback(async (nodeId: string) => {
    await handleRunNode(nodeId);
  }, [handleRunNode]);

  const detailNode = detailNodeId
    ? canvas.nodes.find((node) => node.id === detailNodeId) || null
    : null;

  const selectionRect = useMemo(() => {
    if (!selectionStartPoint || !selectionCurrentPoint) return null;
    const x = Math.min(selectionStartPoint.x, selectionCurrentPoint.x);
    const y = Math.min(selectionStartPoint.y, selectionCurrentPoint.y);
    const width = Math.abs(selectionCurrentPoint.x - selectionStartPoint.x);
    const height = Math.abs(selectionCurrentPoint.y - selectionStartPoint.y);
    if (!isSelectionBoxMeaningful(width, height)) return null;
    return { x, y, width, height };
  }, [selectionCurrentPoint, selectionStartPoint]);

  const transientSelectedNodeIds = useMemo(() => {
    if (!selectionRect) return [];
    return canvas.nodes
      .filter((node) => {
        const size = getProjectAgentCanvasNodeSize(node);
        return (
          node.x < selectionRect.x + selectionRect.width &&
          node.x + size.width > selectionRect.x &&
          node.y < selectionRect.y + selectionRect.height &&
          node.y + size.height > selectionRect.y
        );
      })
      .map((node) => node.id);
  }, [canvas.nodes, selectionRect]);

  useEffect(() => {
    if (!selectionStartPoint) return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [selectionStartPoint]);

  const displayMessages = useMemo(
    () => messages.filter((message) => {
      const parsed = parseProjectAgentMessageParts(message);
      return parsed.visibleText.trim().length > 0 || parsed.reasoningText.trim().length > 0;
    }),
    [messages],
  );

  const activeChatTitle = useMemo(() => {
    const matchedHistoryItem = historyItems.find((item) => item.sessionId === sessionId);
    return matchedHistoryItem?.title || buildHistoryTitle(messages);
  }, [historyItems, messages, sessionId]);

  const filteredHistoryItems = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return historyItems;
    return historyItems.filter((item) => item.title?.toLowerCase().includes(query));
  }, [historyItems, historyQuery]);

  const awaitingAssistantTurn = isStreaming;
  const chatInputPlaceholder = 'Edit the canvas...';

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    const wasAwaitingAssistantTurn = previousAwaitingAssistantTurnRef.current;
    previousAwaitingAssistantTurnRef.current = awaitingAssistantTurn;

    if (!awaitingAssistantTurn || wasAwaitingAssistantTurn) {
      return;
    }

    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      scrollChatToBottom('auto');
      frameTwo = window.requestAnimationFrame(() => {
        scrollChatToBottom('auto');
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [awaitingAssistantTurn, scrollChatToBottom]);

  const sidebarProps = useMemo(() => ({
    credits,
    creditsData,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    userImageUrl: user?.imageUrl,
  }), [credits, creditsData, user?.imageUrl, user?.primaryEmailAddress?.emailAddress]);

  if (!isLoaded || isPageLoading) {
    return <FlowtraLoading />;
  }

  return (
    <div className="project-agent-page h-[100dvh] overflow-hidden text-black">
      <Sidebar {...sidebarProps} />

      <DashboardContentTransition className="dashboard-content-offset bg-background h-[100dvh] overflow-hidden min-h-0">
        <div className="h-full box-border min-h-0 p-3 md:py-3 md:pr-3 md:pl-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <section className="project-agent-panel-shell project-agent-surface relative h-full min-h-0 overflow-visible rounded-[20px]">
              <div className="h-full w-full p-0" ref={canvasContainerRef}>
                <CanvasBoard
                  canvas={canvas}
                  transientSelectedNodeIds={transientSelectedNodeIds}
                  draggingNodeId={draggingNodeId}
                  isPanning={panning}
                  isSelecting={Boolean(selectionStartPoint)}
                  isSpacePressed={spacePressed}
                  selectionRect={selectionRect}
                  pendingConnectionPoint={pendingConnectionPoint}
                  snappedConnectionTarget={snappedConnectionTarget}
                  onBeginConnection={handleBeginConnection}
                  onCanvasDragOver={(event) => event.preventDefault()}
                  onCanvasDrop={handleCanvasDrop}
                  onCanvasPointerDown={handleCanvasPointerDown}
                  onCanvasWheel={handleCanvasWheel}
                  onConnectToHandle={handleConnectToHandle}
                  onDeleteNode={handleDeleteNode}
                  onFormatLayout={handleFormatLayout}
                  onNodeDoubleClick={setDetailNodeId}
                  onNodePointerDown={handleNodePointerDown}
                  onRegenerateFeatureNode={handleRegenerateFeatureNode}
                  onRemoveEdge={handleRemoveEdge}
                  onRunFeatureNode={handleRunNode}
                  onSelectEdge={setSelectedEdgeId}
                  onSelectNode={(nodeId) => updateCanvas((current) => {
                    if (dragMovedRef.current) {
                      dragMovedRef.current = false;
                      return current;
                    }
                    return setSingleSelectedNode(current, nodeId);
                  })}
                  onUpdateNodeContent={handleUpdateNodeContent}
                  pendingConnectionSourceId={pendingConnectionSourceId}
                  selectedEdgeId={selectedEdgeId}
                />
              </div>
              <div data-canvas-ui="true" className="pointer-events-none absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 justify-center">
                <InsertToolbar
                  avatars={avatars}
                  products={products}
                  videos={videos}
                  openKey={toolbarOpenKey}
                  onOpenKeyChange={setToolbarOpenKey}
                  onQuickUploadRequest={handleQuickUploadRequest}
                  selectionMode={pendingUiRequest?.type === 'asset_selection' ? {
                    assetType: pendingUiRequest.assetType,
                    title: pendingUiRequest.title,
                    instructions: pendingUiRequest.instructions,
                  } : null}
                  onAssetSelect={handleToolbarAssetSelect}
                />
              </div>
            </section>

            <section className="project-agent-panel-shell project-agent-chat-surface flowgen-chat-font relative flex h-full min-h-0 flex-col overflow-hidden rounded-[20px]">
              <div className="project-agent-chat-header relative flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-[#1f1f1e]">
                  <MessageCircle className="h-4 w-4" />
                  <span className="truncate whitespace-nowrap text-sm font-semibold">{activeChatTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div ref={historyPopoverRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsHistoryPopoverOpen((prev) => !prev)}
                      className="project-agent-press-button project-agent-toolbar-button inline-flex h-9 w-9 items-center justify-center rounded-[12px] border text-[#1f1f1e]"
                      aria-label="Open history"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    {isHistoryPopoverOpen ? (
                      <div className="project-agent-history-popover absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-[16px] border border-[#e6e6e4] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)]">
                        <div className="px-3 py-3">
                          <p className="text-xs font-semibold text-[#1f1f1e]">History</p>
                          <div className="relative mt-2">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9b9b98]" />
                            <input
                              value={historyQuery}
                              onChange={(event) => setHistoryQuery(event.target.value)}
                              placeholder="Search..."
                              className="project-agent-history-search h-9 w-full rounded-[12px] border border-[#d9d9d7] bg-[#fbfbfa] pl-8 pr-3 text-xs text-[#1f1f1e] placeholder:text-[#a3a3a0] focus:outline-none focus:ring-2 focus:ring-black"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextSessionId = createSessionId();
                              writeCurrentSessionId(nextSessionId);
                              ensureHistoryTracked(nextSessionId);
                              setSessionId(nextSessionId);
                              setCanvas(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
                              setPendingUiRequest(null);
                              setAppliedCanvasActionCallIds([]);
                              setToolbarOpenKey(null);
                              setMessages([]);
                              setDraft('');
                              setStatusNote('');
                              setHistoryQuery('');
                              setIsHistoryPopoverOpen(false);
                            }}
                            className="project-agent-press-button project-agent-toolbar-button mt-2 inline-flex min-h-8 items-center gap-1 rounded-[12px] border px-2.5 text-xs font-medium text-[#1f1f1e]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            New chat
                          </button>
                        </div>
                        <div className="max-h-[360px] space-y-1 overflow-y-auto p-2">
                          {filteredHistoryItems.length === 0 ? (
                            <div className="px-2 py-3 text-xs text-[#787876]">No matching conversations.</div>
                          ) : (
                            filteredHistoryItems.map((item) => (
                              <button
                                key={item.sessionId}
                                type="button"
                                onClick={() => {
                                  writeCurrentSessionId(item.sessionId);
                                  ensureHistoryTracked(item.sessionId);
                                  setSessionId(item.sessionId);
                                  setIsHistoryPopoverOpen(false);
                                }}
                                className={`project-agent-history-item w-full rounded-[12px] border px-2.5 py-2 text-left transition-colors ${
                                  item.sessionId === sessionId
                                    ? 'project-agent-history-item--active border-[#1f1f1e] bg-[#f7f7f5]'
                                    : 'project-agent-history-item--idle border-transparent bg-transparent hover:border-[#e6e6e4] hover:bg-[#f7f7f5]'
                                }`}
                              >
                                <div className="truncate text-[12px] font-medium text-[#1f1f1e]">{item.title}</div>
                                <div className="mt-0.5 text-[10px] text-[#9b9b98]">
                                  {new Date(item.updatedAt).toLocaleString()}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {statusNote ? (
                <div className="project-agent-status-note mx-4 mt-3 inline-flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{statusNote}</span>
                </div>
              ) : null}

              {pendingUiRequest?.type === 'confirmation' ? (
                <div className="project-agent-confirmation mx-4 mt-3 rounded-[14px] border border-[#d9d9d7] bg-[#f7f7f5] px-4 py-3">
                  <p className="project-agent-confirmation-title text-sm font-semibold text-[#1f1f1e]">{pendingUiRequest.title}</p>
                  <p className="project-agent-confirmation-copy mt-1 text-xs leading-5 text-[#6c6c66]">{pendingUiRequest.message}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmPendingAction}
                      className="project-agent-confirmation-primary rounded-[12px] bg-[#111111] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPendingAction}
                      className="project-agent-confirmation-secondary rounded-[12px] border border-[#d3d3d0] bg-white px-3 py-2 text-xs font-semibold text-[#1f1f1e]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div ref={chatScrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  {displayMessages.map((message) => {
                    const { visibleText, reasoningText } = parseProjectAgentMessageParts(message);
                    const messageText = visibleText.trim();
                    const reasoning = reasoningText.trim();
                    const isUserMessage = message.role === 'user';
                    const shouldRenderBubble = isUserMessage || messageText.length > 0;

                    return (
                      <div key={message.id} className={isUserMessage ? 'ml-auto w-fit max-w-[94%]' : 'max-w-[94%]'}>
                        {!isUserMessage && reasoning ? (
                          <details className="mb-2 rounded-[12px] border border-[#d9d9d7] bg-[#f7f7f5] px-3 py-2 text-[#6c6c66]">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium marker:hidden">
                              <span>Analyzed your request</span>
                              <span className="text-[11px] text-[#9b9b98]">Show</span>
                            </summary>
                            <div className="mt-2 border-l border-[#d4d4d1] pl-3 text-sm italic leading-6 text-[#7a7a75]">
                              {reasoning}
                            </div>
                          </details>
                        ) : null}

                        {shouldRenderBubble ? (
                          <div
                            className={`project-agent-chat-bubble rounded-[12px] px-4 py-3 text-sm ${
                              isUserMessage
                                ? 'project-agent-chat-bubble--user bg-[#0f0f0f] text-white leading-7'
                                : 'project-agent-chat-bubble--assistant bg-[#efefed] text-[#1f1f1e] leading-6'
                            }`}
                          >
                            {isUserMessage ? (
                              messageText
                            ) : (
                              <MarkdownRenderer
                                content={messageText}
                                className="project-agent-markdown [&_h1]:!mt-0 [&_h2]:!mt-0 [&_h3]:!mt-0 [&_p:last-child]:!mb-0 [&_p]:!mb-3 [&_p]:!text-[#1f1f1e] [&_li]:!text-[#1f1f1e] [&_ol]:!mb-3 [&_ol]:!text-[#1f1f1e] [&_strong]:!text-[#111111] [&_ul]:!mb-3 [&_ul]:!text-[#1f1f1e]"
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {awaitingAssistantTurn ? (
                    <div className="project-agent-chat-bubble project-agent-chat-bubble--assistant max-w-[94%] rounded-[12px] bg-[#efefed] px-4 py-3 text-sm text-[#787876]">
                      <div className="project-agent-thinking-row flex items-center gap-2.5">
                        <FlowgenThinkingMark
                          size={22}
                          animated
                          tone="inherit"
                          className="project-agent-thinking-mark shrink-0"
                        />
                        <span>thinking...</span>
                      </div>
                    </div>
                  ) : null}
                  <div ref={chatBottomRef} />
                </div>
              </div>

              <div className="project-agent-chat-footer px-4 py-4">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSend();
                  }}
                  className="project-agent-chat-input flex items-end gap-2 rounded-[18px] border border-[#d9d9d7] bg-white p-2 shadow-[0_18px_40px_rgba(15,15,15,0.06)]"
                >
                  <textarea
                    ref={composerInputRef}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      resizeComposerInput(event.target);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={chatInputPlaceholder}
                    rows={1}
                    className="project-agent-chat-input-field flex-1 rounded-[14px] bg-transparent px-4 py-3 text-sm leading-6 text-[#1f1f1e] placeholder:text-[#9b9b98] focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
                    disabled={awaitingAssistantTurn}
                  />
                  <button
                    type="submit"
                    disabled={awaitingAssistantTurn || !draft.trim()}
                    aria-label={awaitingAssistantTurn ? 'Waiting for response' : 'Send message'}
                    className={`project-agent-send-button inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border text-white transition-all duration-200 ease-out disabled:opacity-50 ${
                      awaitingAssistantTurn
                        ? 'project-agent-press-button project-agent-press-button--disabled bg-[#8d8d8a]'
                        : 'project-agent-press-button project-agent-press-button--active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1e]/12'
                    }`}
                  >
                    {awaitingAssistantTurn ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 -translate-y-[0.5px] translate-x-[0.5px]" />
                    )}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </DashboardContentTransition>

      <NodeDetailsDialog
        node={detailNode}
        onOpenChange={(open) => setDetailNodeId(open ? detailNodeId : null)}
        open={Boolean(detailNode)}
      />
      <CreateAvatarModal
        isOpen={showCreateAvatarModal}
        onClose={() => setShowCreateAvatarModal(false)}
        onAvatarCreated={handleAvatarCreated}
      />
      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => setShowCreateProductModal(false)}
        onProductCreated={handleProductCreated}
      />
    </div>
  );
}
