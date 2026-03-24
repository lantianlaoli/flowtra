'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useUser } from '@clerk/nextjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AlertTriangle, ArrowUpRight, History, Loader2, MessageCircle, Plus, Search } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import CanvasBoard from '@/components/project-agent/canvas/CanvasBoard';
import InsertToolbar from '@/components/project-agent/canvas/InsertToolbar';
import NodeDetailsDialog from '@/components/project-agent/canvas/NodeDetailsDialog';
import { useCredits } from '@/contexts/CreditsContext';
import { toProjectAgentVideoAssets } from '@/lib/project-agent/canvas-assets';
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
  getConnectedAssetNodeMap,
  getCanvasConnectionError,
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

const renderUIMessageText = (message: UIMessage) => {
  if (!Array.isArray(message.parts)) return '';
  return message.parts
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('');
};

export const hasVisibleAssistantReplyAfterLatestUserTurn = (messages: UIMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant' && renderUIMessageText(message).trim().length > 0) {
      return true;
    }
    if (message.role === 'user' && renderUIMessageText(message).trim().length > 0) {
      return false;
    }
  }
  return false;
};

const buildHistoryTitle = (messages: UIMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);
  if (!firstUserMessage) return 'New canvas session';
  return renderUIMessageText(firstUserMessage).trim().slice(0, 80);
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

const isFeaturePhrase = (text: string, feature: ProjectAgentFeatureNodeType) => {
  if (feature === 'avatar_ads') return /avatar ads|character ads/i.test(text);
  if (feature === 'motion_clone') return /motion clone/i.test(text);
  return /video clone|ugc clone|clone node/i.test(text);
};

const isAssetPhrase = (text: string, assetType: ProjectAgentAssetNodeType) => {
  if (assetType === 'avatar') return /add .*avatar node|放.*avatar 节点|create .*avatar node/i.test(text);
  if (assetType === 'product') return /add .*product node|放.*product 节点|create .*product node/i.test(text);
  return /add .*video node|放.*video 节点|create .*video node/i.test(text);
};

export default function ProjectAgentPage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const supabase = useSupabaseBrowserClient();
  const [sessionId, setSessionId] = useState('');
  const [canvas, setCanvas] = useState<ProjectAgentCanvasState>(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  const [draft, setDraft] = useState('');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [statusNote, setStatusNote] = useState('');
  const [avatars, setAvatars] = useState<ProjectAgentCanvasAssetRef[]>([]);
  const [products, setProducts] = useState<ProjectAgentCanvasAssetRef[]>([]);
  const [videos, setVideos] = useState<ProjectAgentCanvasAssetRef[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
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
  const historyPopoverRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const persistenceTimeoutRef = useRef<number | null>(null);
  const statusFetchInFlightRef = useRef<Set<string>>(new Set());
  const subscriptionsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const supabaseRef = useRef(supabase);
  const connectionCommittedRef = useRef(false);

  const ensureHistoryTracked = useCallback((id: string) => {
    const current = readHistoryIds();
    const next = [id, ...current.filter((item) => item !== id)];
    writeHistoryIds(next);
  }, []);

  const refreshHistory = useCallback(async () => {
    const ids = readHistoryIds();
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
  }, []);

  const persistCanvasState = useCallback((nextCanvas: ProjectAgentCanvasState) => {
    if (!sessionId) return;
    if (persistenceTimeoutRef.current) {
      window.clearTimeout(persistenceTimeoutRef.current);
    }
    persistenceTimeoutRef.current = window.setTimeout(() => {
      void fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statePatch: { canvas: nextCanvas },
        }),
      });
    }, 180);
  }, [sessionId]);

  const updateCanvas = useCallback((updater: ProjectAgentCanvasState | ((current: ProjectAgentCanvasState) => ProjectAgentCanvasState)) => {
    setCanvas((current) => {
      const next = typeof updater === 'function'
        ? (updater as (current: ProjectAgentCanvasState) => ProjectAgentCanvasState)(current)
        : updater;
      persistCanvasState(next);
      return next;
    });
  }, [persistCanvasState]);

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
            canvas,
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
      setMessages([]);
      return;
    }
    const payload = await response.json() as PersistedSessionPayload;
    const incomingCanvas = normalizeCanvasState(payload.session?.state?.canvas);
    setCanvas(incomingCanvas);
    if (Array.isArray(payload.session?.messages)) {
      setMessages(payload.session.messages);
    } else {
      setMessages([]);
    }
  }, [ensureSessionExists, setMessages]);

  useEffect(() => {
    if (!isLoaded) return;
    const nextSessionId = readCurrentSessionId() || createSessionId();
    writeCurrentSessionId(nextSessionId);
    ensureHistoryTracked(nextSessionId);
    setSessionId(nextSessionId);
  }, [ensureHistoryTracked, isLoaded]);

  useEffect(() => {
    if (!sessionId) return;
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
  }, [fetchSession, loadAssets, refreshHistory, sessionId]);

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
        const canStart = missingInputs.length === 0;
        const executionState = node.runtime?.executionState;
        const preservedState = executionState === 'running' || executionState === 'completed' || executionState === 'failed';
        const nextState: 'ready' | 'invalid' = canStart ? 'ready' : 'invalid';
        const nextStatusLabel = canStart ? 'Ready to start' : `Need ${missingInputs.join(', ')}`;
        const runtime = {
          ...(node.runtime || {}),
          missingInputs,
          canStart,
          executionState: preservedState ? executionState : nextState,
          statusLabel: preservedState ? node.runtime?.statusLabel : nextStatusLabel,
        };
        if (
          node.runtime?.executionState === runtime.executionState &&
          node.runtime?.statusLabel === runtime.statusLabel &&
          JSON.stringify(node.runtime?.missingInputs || []) === JSON.stringify(missingInputs) &&
          node.runtime?.canStart === canStart
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
      persistCanvasState(next);
      return next;
    });
  }, [canvas.edges, canvas.nodes, persistCanvasState]);

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
          canStart: missingInputs.length === 0,
        },
      });

      // When completed with an output URL, ensure an independent output_video node exists
      if (execution.executionState === 'completed' && execution.outputUrl) {
        const outputNodeId = `output-${nodeId}`;
        const existing = getProjectAgentCanvasNodeById(next, outputNodeId);
        const outputNode = {
          id: outputNodeId,
          type: 'output_video' as const,
          // Preserve position if already placed, otherwise initialize to the right of the feature node
          x: existing?.x ?? node.x + 328,
          y: existing?.y ?? node.y - 75,
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
      const table = node.type === 'avatar_ads'
        ? 'avatar_ads_projects'
        : node.type === 'video_clone'
          ? 'competitor_ugc_replication_projects'
          : 'motion_clone_projects';
      const channelKey = `${table}:${node.runtime.projectId}`;
      if (subscriptionsRef.current.has(channelKey)) return;
      const channel = supabase
        .channel(`project-agent-canvas-${channelKey}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: `id=eq.${node.runtime.projectId}`,
        }, () => {
          void fetchNodeStatus(node.id, node.type as ProjectAgentFeatureNodeType, node.runtime?.projectId || '');
        })
        .subscribe();
      subscriptionsRef.current.set(channelKey, channel);
      // Immediately fetch current status for running nodes to sync stale session state
      if (node.runtime.executionState === 'running') {
        void fetchNodeStatus(node.id, node.type as ProjectAgentFeatureNodeType, node.runtime.projectId);
      }
    });

    // Remove channels for nodes that no longer have a projectId
    const activeKeys = new Set(
      canvas.nodes
        .filter((n) => isProjectAgentFeatureNode(n.type) && n.runtime?.projectId)
        .map((n) => {
          const table = n.type === 'avatar_ads'
            ? 'avatar_ads_projects'
            : n.type === 'video_clone'
              ? 'competitor_ugc_replication_projects'
              : 'motion_clone_projects';
          return `${table}:${n.runtime!.projectId}`;
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
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      subscriptionsRef.current.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
      subscriptionsRef.current.clear();
    };
  // Only run on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      };
    });
  }, [updateCanvas]);

  const applyChatIntent = useCallback((text: string) => {
    const normalized = text.toLowerCase();
    let changed = false;

    if (/delete node|remove node|删除节点/.test(normalized) && canvas.selectedNodeId) {
      updateCanvas((current) => removeCanvasNode(current, canvas.selectedNodeId!));
      setDetailNodeId(null);
      changed = true;
    }

    if (isAssetPhrase(normalized, 'avatar') && !/avatar ads|character ads/.test(normalized) && avatars[0]) {
      addAssetNode('avatar', avatars[0]);
      changed = true;
    }
    if (isAssetPhrase(normalized, 'product') && products[0]) {
      addAssetNode('product', products[0]);
      changed = true;
    }
    if (isAssetPhrase(normalized, 'video') && videos[0] && !/video clone|motion clone/.test(normalized)) {
      addAssetNode('video', videos[0]);
      changed = true;
    }

    const featureType = (['avatar_ads', 'video_clone', 'motion_clone'] as ProjectAgentFeatureNodeType[])
      .find((item) => isFeaturePhrase(normalized, item));

    if (featureType) {
      let createdNodeId = '';
      updateCanvas((current) => {
        const placement = getDefaultNodePlacement(current);
        const nextNode = createProjectAgentFeatureNode({
          type: featureType,
          x: placement.x + 260,
          y: placement.y,
        });
        createdNodeId = nextNode.id;
        let nextState: ProjectAgentCanvasState = {
          ...upsertCanvasNode(current, nextNode),
          selectedNodeId: nextNode.id,
        };

        if (/connect|连接/.test(normalized)) {
          const requirements = featureType === 'avatar_ads'
            ? (['avatar', 'product'] as ProjectAgentAssetNodeType[])
            : (['avatar', 'product', 'video'] as ProjectAgentAssetNodeType[]);

          requirements.forEach((handle) => {
            const sourceNode = nextState.nodes.find((node) => node.type === handle && node.asset);
            if (!sourceNode) return;
            nextState = connectCanvasNodes(nextState, {
              id: createProjectAgentCanvasEdgeId(sourceNode.id, nextNode.id, handle),
              sourceNodeId: sourceNode.id,
              targetNodeId: nextNode.id,
              targetHandle: handle,
            });
          });
        }

        return nextState;
      });

      if (createdNodeId) {
        setDetailNodeId(createdNodeId);
      }
      changed = true;
    }

    if (changed) {
      setStatusNote('Canvas updated from your chat instruction.');
    }
  }, [addAssetNode, avatars, canvas.selectedNodeId, products, updateCanvas, videos]);

  const handleSend = useCallback(async () => {
    if (!sessionId || !draft.trim()) return;
    ensureHistoryTracked(sessionId);
    applyChatIntent(draft);
    const text = draft;
    setDraft('');
    setStatusNote('');
    await sendMessage({ text });
  }, [applyChatIntent, draft, ensureHistoryTracked, sendMessage, sessionId]);

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
        };
      });
    }
  }, [addAssetNode, addFeatureNode, getCanvasPointFromClient, updateCanvas]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    event.stopPropagation();
    const bounds = canvasContainerRef.current?.getBoundingClientRect();
    const node = getProjectAgentCanvasNodeById(canvas, nodeId);
    if (!bounds || !node) return;
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: (event.clientX - bounds.left - canvas.viewport.x) / canvas.viewport.zoom - node.x,
      y: (event.clientY - bounds.top - canvas.viewport.y) / canvas.viewport.zoom - node.y,
    });
  }, [canvas]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = (
        target?.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      );

      if (isEditable) return;
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
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (draggingNodeId && canvasContainerRef.current) {
        const point = getCanvasPointFromClient(event.clientX, event.clientY);
        if (!point) return;
        const x = point.x - dragOffset.x;
        const y = point.y - dragOffset.y;
        updateCanvas((current) => {
          const node = getProjectAgentCanvasNodeById(current, draggingNodeId);
          if (!node) return current;
          return upsertCanvasNode(current, { ...node, x, y });
        });
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
      setPanning(false);
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
  }, [dragOffset.x, dragOffset.y, draggingNodeId, getCanvasPointFromClient, getSnappedConnectionTarget, panOrigin.viewportX, panOrigin.viewportY, panOrigin.x, panOrigin.y, panning, pendingConnectionSourceId, snappedConnectionTarget, updateCanvas]);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-canvas-node="true"]')) return;
    setPendingConnectionSourceId(null);
    setPendingConnectionPoint(null);
    setSnappedConnectionTarget(null);
    setSelectedEdgeId(null);
    setDetailNodeId(null);
    updateCanvas((current) => ({ ...current, selectedNodeId: null }));
    if (!spacePressed) return;
    event.preventDefault();
    setPanning(true);
    setPanOrigin({
      x: event.clientX,
      y: event.clientY,
      viewportX: canvas.viewport.x,
      viewportY: canvas.viewport.y,
    });
  }, [canvas.viewport.x, canvas.viewport.y, spacePressed, updateCanvas]);

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextZoom = Math.min(1.6, Math.max(0.55, canvas.viewport.zoom - event.deltaY * 0.001));
    updateCanvas((current) => ({
      ...current,
      viewport: {
        ...current.viewport,
        zoom: Number(nextZoom.toFixed(2)),
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
        if (node.type === 'video') return 246;
        if (isProjectAgentAssetNode(node.type)) return 224;
        if (isProjectAgentFeatureNode(node.type)) return 216;
        return 246;
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
          ...(nextNode.runtime || {}),
          executionState: 'running',
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

  const detailNode = detailNodeId
    ? canvas.nodes.find((node) => node.id === detailNodeId) || null
    : null;

  const displayMessages = useMemo(
    () => messages.filter((message) => renderUIMessageText(message).trim().length > 0),
    [messages],
  );

  const activeChatTitle = useMemo(() => {
    const matchedHistoryItem = historyItems.find((item) => item.sessionId === sessionId);
    return matchedHistoryItem?.title || buildHistoryTitle(messages);
  }, [historyItems, messages, sessionId]);

  const filteredHistoryItems = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return historyItems;
    return historyItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [historyItems, historyQuery]);

  const awaitingAssistantTurn = isStreaming;
  const chatInputPlaceholder = 'Tell the agent what to build next...';

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

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background h-[100dvh] overflow-hidden min-h-0">
        <div className="h-full box-border min-h-0 p-3 md:py-3 md:pr-3 md:pl-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <section className="project-agent-panel-shell relative h-full min-h-0 overflow-hidden rounded-[30px]">
              <div className="h-full w-full p-0" ref={canvasContainerRef}>
                <CanvasBoard
                  canvas={canvas}
                  isPanning={panning}
                  isSpacePressed={spacePressed}
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
                  onRemoveEdge={handleRemoveEdge}
                  onRunFeatureNode={handleRunNode}
                  onSelectEdge={setSelectedEdgeId}
                  onSelectNode={(nodeId) => updateCanvas((current) => ({ ...current, selectedNodeId: nodeId }))}
                  onUpdateNodeContent={handleUpdateNodeContent}
                  pendingConnectionSourceId={pendingConnectionSourceId}
                  selectedEdgeId={selectedEdgeId}
                />
              </div>
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
                <InsertToolbar
                  avatars={avatars}
                  products={products}
                  videos={videos}
                />
              </div>
            </section>

            <section className="project-agent-panel-shell project-agent-chat-surface flowgen-chat-font flex h-full min-h-0 flex-col overflow-hidden rounded-[30px]">
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
                      className="project-agent-toolbar-button inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d9d9d7] bg-white text-[#1f1f1e] hover:bg-[#f3f3f2]"
                      aria-label="Open history"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    {isHistoryPopoverOpen ? (
                      <div className="project-agent-history-popover absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#e6e6e4] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)]">
                        <div className="px-3 py-3">
                          <p className="text-xs font-semibold text-[#1f1f1e]">History</p>
                          <div className="relative mt-2">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9b9b98]" />
                            <input
                              value={historyQuery}
                              onChange={(event) => setHistoryQuery(event.target.value)}
                              placeholder="Search..."
                              className="project-agent-history-search h-9 w-full rounded-xl border border-[#d9d9d7] bg-[#fbfbfa] pl-8 pr-3 text-xs text-[#1f1f1e] placeholder:text-[#a3a3a0] focus:outline-none focus:ring-2 focus:ring-black"
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
                              setMessages([]);
                              setDraft('');
                              setStatusNote('');
                              setHistoryQuery('');
                              setIsHistoryPopoverOpen(false);
                            }}
                            className="project-agent-toolbar-button mt-2 inline-flex min-h-8 items-center gap-1 rounded-xl border border-[#d9d9d7] bg-white px-2.5 text-xs font-medium text-[#1f1f1e] hover:bg-[#f3f3f2]"
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
                                className={`project-agent-history-item w-full rounded-xl border px-2.5 py-2 text-left transition-colors ${
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
                <div className="project-agent-status-note mx-4 mt-3 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{statusNote}</span>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  {displayMessages.map((message) => {
                    const messageText = renderUIMessageText(message).trim();
                    const isUserMessage = message.role === 'user';

                    return (
                      <div key={message.id} className={isUserMessage ? 'ml-auto w-fit max-w-[94%]' : 'max-w-[94%]'}>
                        <div
                          className={`project-agent-chat-bubble rounded-xl px-4 py-3 text-sm ${
                            isUserMessage
                              ? 'project-agent-chat-bubble--user bg-[#0f0f0f] text-white leading-7'
                              : 'project-agent-chat-bubble--assistant bg-[#efefed] text-[#1f1f1e] leading-6'
                          }`}
                        >
                          {messageText}
                        </div>
                      </div>
                    );
                  })}

                  {awaitingAssistantTurn ? (
                    <div className="project-agent-chat-bubble project-agent-chat-bubble--assistant max-w-[94%] rounded-xl bg-[#efefed] px-4 py-3 text-sm text-[#787876]">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Working on it...</span>
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
                  className="project-agent-chat-input mt-3 flex items-center gap-2 rounded-[26px] border border-[#d9d9d7] bg-white p-2 shadow-[0_18px_40px_rgba(15,15,15,0.06)]"
                >
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={chatInputPlaceholder}
                    className="project-agent-chat-input-field flex-1 min-h-12 rounded-[18px] bg-transparent px-4 text-sm text-[#1f1f1e] placeholder:text-[#9b9b98] focus:outline-none disabled:opacity-50"
                    disabled={awaitingAssistantTurn}
                  />
                  <button
                    type="submit"
                    disabled={awaitingAssistantTurn || !draft.trim()}
                    aria-label={awaitingAssistantTurn ? 'Waiting for response' : 'Send message'}
                    className={`project-agent-send-button inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200 ease-out disabled:opacity-50 ${
                      awaitingAssistantTurn
                        ? 'bg-[#8d8d8a]'
                        : 'bg-[#0f0f0f] shadow-[0_10px_24px_rgba(15,15,15,0.16)] hover:-translate-y-[1px] hover:scale-[1.03] hover:bg-[#1a1a1a] hover:shadow-[0_16px_32px_rgba(15,15,15,0.2)] active:translate-y-0 active:scale-[0.97] active:bg-black active:shadow-[0_8px_18px_rgba(15,15,15,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1e]/12'
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
    </div>
  );
}
