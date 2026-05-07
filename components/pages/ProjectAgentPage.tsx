'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { useUser } from '@clerk/nextjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AlertTriangle, Clapperboard, Construction, Sparkles, Type, User, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import CreateAvatarModal from '@/components/CreateAvatarModal';
import CreateProductModal from '@/components/CreateProductModal';
import VideoImportModal from '@/components/VideoImportModal';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import { PromptInputBox, type PromptCommand } from '@/components/ui/ai-prompt-box';
import {
  ProjectAgentWelcomeTourModal,
  isProjectAgentWelcomeTourDismissed,
} from '@/components/project-agent/ProjectAgentWelcomeTourModal';
import CanvasBoard from '@/components/project-agent/canvas/CanvasBoard';
import InsertToolbar from '@/components/project-agent/canvas/InsertToolbar';
import NodeDetailsDialog from '@/components/project-agent/canvas/NodeDetailsDialog';
import { useCredits } from '@/contexts/CreditsContext';
import { useI18n } from '@/providers/I18nProvider';
import { toProjectAgentVideoAssets } from '@/lib/project-agent/canvas-assets';
import {
  createProjectAgentCanvasNotice,
  type ProjectAgentCanvasNotice,
} from '@/lib/project-agent/canvas-ui';
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
  getProjectAgentCanvasTargetHandlePosition,
  getConnectedAssetNodeMap,
  getCanvasConnectionError,
  getFeatureStartBlockedReason,
  formatMissingFeatureInputsLabel,
  getProjectAgentCanvasNodeById,
  isProjectAgentAssetNode,
  isProjectAgentFeatureNode,
  isProjectAgentOutputNode,
  isProjectAgentRuntimeActive,
  normalizeCanvasState,
  removeCanvasEdge,
  removeCanvasNode,
  upsertCanvasNode,
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasAssetRef,
  type ProjectAgentCanvasNode,
  type ProjectAgentCanvasRunStatus,
  type ProjectAgentCanvasState,
  type ProjectAgentFeatureNodeConfig,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import {
  getProjectAgentCanvasErrorInfo,
  normalizeExecutionStatus,
  createQueuedExecutionStatus,
  getExecutionTableForNodeType,
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

type ProjectAgentVideoImportHandler = ComponentProps<typeof VideoImportModal>['onImported'];

const CANVAS_NOTICE_TIMEOUT_MS = 5000;

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

export const getProjectAgentDisplayMessageKey = (message: UIMessage, index: number) => {
  const visibleText = getProjectAgentVisibleMessageText(message).trim();
  const reasoningText = parseProjectAgentMessageParts(message).reasoningText.trim();
  const contentSignature = (visibleText || reasoningText || '').slice(0, 80);
  return `${message.id}:${message.role}:${contentSignature}:${index}`;
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
        isSystem: item.isSystem === true,
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
        isSystem: item.isSystem === true,
      };
    }) as ProjectAgentCanvasAssetRef[];
};

const toVideoAssets = (payload: Record<string, unknown>) => (
  toProjectAgentVideoAssets(payload.videos) as ProjectAgentCanvasAssetRef[]
);

const quoteCommandAssetName = (name: string) => name.replace(/"/g, '\\"');

const createPromptCommandForAsset = (
  assetType: 'avatar' | 'product' | 'video',
  asset: ProjectAgentCanvasAssetRef
): PromptCommand => {
  const typeLabel = assetType === 'avatar' ? 'Avatar' : assetType === 'product' ? 'Product' : 'Video';
  return {
    id: `${assetType}:${asset.id}`,
    label: asset.name,
    chipLabel: `${typeLabel}: ${asset.name}`,
    prompt: `Add ${assetType} "${quoteCommandAssetName(asset.name)}" to the canvas.`,
    kind: 'asset',
    groupLabel: `${typeLabel}s`,
    assetType,
    assetId: asset.id,
    imageUrl: asset.imageUrl,
  };
};

const getDefaultNodePlacement = (canvas: ProjectAgentCanvasState) => ({
  x: 240 - canvas.viewport.x / canvas.viewport.zoom,
  y: 180 - canvas.viewport.y / canvas.viewport.zoom,
});

const isInteractiveNodeSurface = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'video,button,a,input,textarea,select,summary,[contenteditable="true"],[data-node-control="true"]'
    )
  );
};

const setSingleSelectedNode = (current: ProjectAgentCanvasState, nodeId: string | null): ProjectAgentCanvasState => ({
  ...current,
  selectedNodeId: nodeId,
  selectedNodeIds: nodeId ? [nodeId] : [],
});

const isSelectionBoxMeaningful = (width: number, height: number) => width > 6 || height > 6;

const getProjectAgentPageMessages = (locale: string) => {
  if (locale === 'zh') {
    return {
      defaults: {
        avatar: '头像',
        product: '产品',
        text: '文本',
      },
      history: {
        open: '打开历史记录',
        title: '历史记录',
        searchPlaceholder: '搜索...',
        newChat: '新对话',
        empty: '没有匹配的对话。',
      },
    };
  }

  return {
    defaults: {
      avatar: 'Avatar',
      product: 'Product',
      text: 'Text',
    },
    history: {
      open: 'Open history',
      title: 'History',
      searchPlaceholder: 'Search...',
      newChat: 'New chat',
      empty: 'No matching conversations.',
    },
  };
};

export default function ProjectAgentPage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const { locale } = useI18n();
  const pageMessages = getProjectAgentPageMessages(locale);
  const supabase = useSupabaseBrowserClient();
  const [sessionId, setSessionId] = useState('');
  const [canvas, setCanvas] = useState<ProjectAgentCanvasState>(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  const [draft, setDraft] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [canvasNotice, setCanvasNotice] = useState<ProjectAgentCanvasNotice | null>(null);
  const [pendingUiRequest, setPendingUiRequest] = useState<ProjectAgentPendingUiRequest | null>(null);
  const [appliedCanvasActionCallIds, setAppliedCanvasActionCallIds] = useState<string[]>([]);
  const [toolbarOpenKey, setToolbarOpenKey] = useState<'avatar' | 'product' | 'video' | 'feature' | null>(null);
  const [showCreateAvatarModal, setShowCreateAvatarModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showVideoImportModal, setShowVideoImportModal] = useState(false);
  const [pendingPromptAssetType, setPendingPromptAssetType] = useState<'avatar' | 'product' | 'video' | null>(null);
  const [injectedPromptCommandToken, setInjectedPromptCommandToken] = useState<{ nonce: string; command: PromptCommand } | null>(null);
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
  const [isWelcomeTourOpen, setIsWelcomeTourOpen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<ProjectAgentCanvasState>(DEFAULT_PROJECT_AGENT_CANVAS_STATE);
  const persistenceTimeoutRef = useRef<number | null>(null);
  const canvasNoticeTimeoutRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const statusFetchInFlightRef = useRef<Set<string>>(new Set());
  const subscriptionsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const supabaseRef = useRef(supabase);
  const connectionCommittedRef = useRef(false);
  const pendingUiRequestRef = useRef<ProjectAgentPendingUiRequest | null>(null);
  const appliedCanvasActionCallIdsRef = useRef<string[]>([]);
  const processedCanvasToolCallIdsRef = useRef<Set<string>>(new Set());
  const hasCheckedWelcomeTourRef = useRef(false);

  const ensureHistoryTracked = useCallback((id: string) => {
    const current = readHistoryIds();
    const next = [id, ...current.filter((item) => item !== id)];
    writeHistoryIds(next);
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem('project_agent_open_feature_toolbar') !== '1') return;
    window.sessionStorage.removeItem('project_agent_open_feature_toolbar');
    setToolbarOpenKey('feature');
  }, []);

  useEffect(() => () => {
    if (canvasNoticeTimeoutRef.current) {
      window.clearTimeout(canvasNoticeTimeoutRef.current);
    }
  }, []);

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

  const dismissCanvasNotice = useCallback(() => {
    if (canvasNoticeTimeoutRef.current) {
      window.clearTimeout(canvasNoticeTimeoutRef.current);
      canvasNoticeTimeoutRef.current = null;
    }
    setCanvasNotice(null);
  }, []);

  const showCanvasNotice = useCallback((message: string) => {
    const nextNotice = createProjectAgentCanvasNotice(message);
    if (!nextNotice) return;

    if (canvasNoticeTimeoutRef.current) {
      window.clearTimeout(canvasNoticeTimeoutRef.current);
    }

    setCanvasNotice(nextNotice);
    canvasNoticeTimeoutRef.current = window.setTimeout(() => {
      setCanvasNotice(null);
      canvasNoticeTimeoutRef.current = null;
    }, CANVAS_NOTICE_TIMEOUT_MS);
  }, []);

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
        language: locale,
      }, 180);
      return next;
    });
  }, [locale, persistSessionState]);

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
            language: locale,
          },
        },
      }),
    }),
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
        statePatch: { canvas: DEFAULT_PROJECT_AGENT_CANVAS_STATE, language: locale },
      }),
    });
  }, [locale]);

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
    if (!isLoaded || !user || isPageLoading || hasCheckedWelcomeTourRef.current) return;
    hasCheckedWelcomeTourRef.current = true;
    if (!isProjectAgentWelcomeTourDismissed()) {
      setIsWelcomeTourOpen(true);
    }
  }, [isLoaded, isPageLoading, user]);

  useEffect(() => {
    if (!sessionId || !user) return;
    let cancelled = false;

    const load = async () => {
      setIsPageLoading(true);
      try {
        await Promise.all([
          loadAssets(),
          fetchSession(sessionId),
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
  }, [fetchSession, loadAssets, sessionId, user]);

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
    if (!sessionId || !sessionReady) return;
    persistSessionState({ language: locale });
  }, [locale, persistSessionState, sessionId, sessionReady]);

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
        const maintenanceBlocked = Boolean(node.runtime?.maintenanceBlocked);
        const canStart = missingInputs.length === 0 && !blockedReason && !maintenanceBlocked;
        const executionState = node.runtime?.executionState;
        const preservedState = (
          isProjectAgentRuntimeActive(node.runtime) ||
          executionState === 'completed' ||
          executionState === 'failed'
        );
        const preservedExecutionState = executionState ?? 'running';
        const nextState: 'ready' | 'invalid' = canStart ? 'ready' : 'invalid';
        const nextStatusLabel = canStart
          ? 'Ready to start'
          : maintenanceBlocked
            ? 'Maintenance'
            : blockedReason || `Need ${formatMissingFeatureInputsLabel(featureType, missingInputs)}`;
        const runtime = {
          ...(node.runtime || {}),
          missingInputs,
          canStart,
          blockedReason,
          maintenanceBlocked,
          executionState: preservedState ? preservedExecutionState : nextState,
          statusLabel: preservedState ? node.runtime?.statusLabel : nextStatusLabel,
        };
        if (
          node.runtime?.executionState === runtime.executionState &&
          node.runtime?.statusLabel === runtime.statusLabel &&
          JSON.stringify(node.runtime?.missingInputs || []) === JSON.stringify(missingInputs) &&
          node.runtime?.canStart === canStart &&
          node.runtime?.blockedReason === blockedReason &&
          Boolean(node.runtime?.maintenanceBlocked) === maintenanceBlocked
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
        language: locale,
      }, 180);
      return next;
    });
  }, [canvas.edges, canvas.nodes, locale, persistSessionState]);

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
      const canStart = missingInputs.length === 0 && !blockedReason;
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
          userFacingError: execution.userFacingError || null,
          retryable: execution.retryable,
          statusLabel: execution.statusLabel,
          milestones: execution.milestones,
          currentMilestoneKey: execution.currentMilestoneKey,
          missingInputs,
          canStart,
          blockedReason,
          maintenanceBlocked: false,
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
          ? `/api/video-clone/${projectId}/status`
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
    } catch {
      // Status polling is best-effort; transient network failures should not surface
      // as unhandled rejections because Realtime/interval refreshes will retry.
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
                key: `video_clone_projects:${node.runtime.projectId}`,
                channelName: `project-agent-canvas-video_clone_projects:${node.runtime.projectId}`,
                table: 'video_clone_projects',
                filter: `id=eq.${node.runtime.projectId}`,
              },
              {
                key: `video_clone_segments:${node.runtime.projectId}`,
                channelName: `project-agent-canvas-video_clone_segments:${node.runtime.projectId}`,
                table: 'video_clone_segments',
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
            `video_clone_projects:${n.runtime.projectId}`,
            `video_clone_segments:${n.runtime.projectId}`,
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
      isProjectAgentRuntimeActive(node.runtime)
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
      const targetPoint = getProjectAgentCanvasTargetHandlePosition(node);
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
        language: locale,
      });
      return next;
    });
  }, [locale, persistSessionState]);

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
      if (result.statusNote) {
        showCanvasNotice(result.statusNote);
      }
      persistSessionState({
        canvas: result.canvas,
        pendingUiRequest: result.pendingUiRequest,
        appliedCanvasActionCallIds: appliedCanvasActionCallIdsRef.current,
        language: locale,
      }, 180);
      return result.canvas;
    });
  }, [detailNodeId, locale, persistSessionState, showCanvasNotice]);

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

  const handleQuickUploadRequest = useCallback((assetType: 'avatar' | 'product' | 'video') => {
    setPendingPromptAssetType(null);
    if (assetType === 'avatar') {
      setShowCreateAvatarModal(true);
      return;
    }
    if (assetType === 'video') {
      setShowVideoImportModal(true);
      return;
    }
    setShowCreateProductModal(true);
  }, []);

  const handlePromptAssetCreateRequest = useCallback((assetType: 'avatar' | 'product' | 'video') => {
    setPendingPromptAssetType(assetType);
    if (assetType === 'avatar') {
      setShowCreateAvatarModal(true);
      return;
    }
    if (assetType === 'video') {
      setShowVideoImportModal(true);
      return;
    }
    setShowCreateProductModal(true);
  }, []);

  const handleAvatarCreated = useCallback((avatar: UserAvatar) => {
    const createdAsset: ProjectAgentCanvasAssetRef = {
      id: avatar.id,
      name: avatar.avatar_name || avatar.file_name || pageMessages.defaults.avatar,
      imageUrl: avatar.primary_photo_url || avatar.photo_url || null,
      photos: [
        avatar.primary_photo_url || avatar.photo_url,
        ...(Array.isArray(avatar.reference_photos) ? avatar.reference_photos.map((photo) => photo.photo_url) : []),
      ].filter((url): url is string => typeof url === 'string'),
    };

    void loadAssets();
    setShowCreateAvatarModal(false);

    if (pendingPromptAssetType === 'avatar') {
      setInjectedPromptCommandToken({
        nonce: `avatar:${createdAsset.id}:${Date.now()}`,
        command: createPromptCommandForAsset('avatar', createdAsset),
      });
      setPendingPromptAssetType(null);
    }

    if (pendingUiRequest?.type === 'asset_selection' && pendingUiRequest.assetType === 'avatar') {
      handleToolbarAssetSelect('avatar', createdAsset);
      setToolbarOpenKey(null);
    }
  }, [handleToolbarAssetSelect, loadAssets, pageMessages.defaults.avatar, pendingPromptAssetType, pendingUiRequest]);

  const handleProductCreated = useCallback((product: UserProduct) => {
    const photoUrls = Array.isArray(product.user_product_photos)
      ? product.user_product_photos.map((photo) => photo.photo_url).filter((url): url is string => typeof url === 'string')
      : [];

    const createdAsset: ProjectAgentCanvasAssetRef = {
      id: product.id,
      name: product.product_name || pageMessages.defaults.product,
      imageUrl: photoUrls[0] || null,
      photos: photoUrls,
    };

    void loadAssets();
    setShowCreateProductModal(false);

    if (pendingPromptAssetType === 'product') {
      setInjectedPromptCommandToken({
        nonce: `product:${createdAsset.id}:${Date.now()}`,
        command: createPromptCommandForAsset('product', createdAsset),
      });
      setPendingPromptAssetType(null);
    }

    if (pendingUiRequest?.type === 'asset_selection' && pendingUiRequest.assetType === 'product') {
      handleToolbarAssetSelect('product', createdAsset);
      setToolbarOpenKey(null);
    }
  }, [handleToolbarAssetSelect, loadAssets, pageMessages.defaults.product, pendingPromptAssetType, pendingUiRequest]);

  const handleVideosImported = useCallback<ProjectAgentVideoImportHandler>((newVideos, options) => {
    const importedAssets = toProjectAgentVideoAssets(newVideos);
    if (importedAssets.length > 0) {
      setVideos((current) => {
        const importedIds = new Set(importedAssets.map((asset) => asset.id));
        return [
          ...importedAssets,
          ...current.filter((asset) => !importedIds.has(asset.id)),
        ];
      });
    }

    if (!options?.skipRefresh) {
      void loadAssets();
    }

    if (importedAssets.length > 0 && pendingPromptAssetType === 'video') {
      const importedAsset = importedAssets[0];
      setInjectedPromptCommandToken({
        nonce: `video:${importedAsset.id}:${Date.now()}`,
        command: createPromptCommandForAsset('video', importedAsset),
      });
      setPendingPromptAssetType(null);
    }

    if (
      importedAssets.length > 0 &&
      pendingUiRequest?.type === 'asset_selection' &&
      pendingUiRequest.assetType === 'video'
    ) {
      handleToolbarAssetSelect('video', importedAssets[0]);
      setToolbarOpenKey(null);
    }
  }, [handleToolbarAssetSelect, loadAssets, pendingPromptAssetType, pendingUiRequest]);

  const handleContinueInAgentFeatures = useCallback(() => {
    setShowVideoImportModal(false);
    setToolbarOpenKey('feature');
  }, []);

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
      language: locale,
    });
  }, [locale, persistSessionState]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const text = (messageOverride ?? draft).trim();
    if (!sessionId || !text) return;
    ensureHistoryTracked(sessionId);
    setDraft('');
    setStatusNote('');
    dismissCanvasNotice();
    await sendMessage({ text });
  }, [dismissCanvasNotice, draft, ensureHistoryTracked, sendMessage, sessionId]);

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
          label: pageMessages.defaults.text,
          asset: { id: nodeId, name: pageMessages.defaults.text, content: '' },
        };
        return {
          ...upsertCanvasNode(current, nextNode),
          selectedNodeId: nodeId,
          selectedNodeIds: [nodeId],
        };
      });
    }
  }, [addAssetNode, addFeatureNode, getCanvasPointFromClient, pageMessages.defaults.text, updateCanvas]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
    if (isInteractiveNodeSurface(event.target)) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    event.preventDefault();
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
            showCanvasNotice(snappedConnectionTarget.errorMessage);
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
    event.preventDefault();
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
      showCanvasNotice(errorMessage);
      setPendingConnectionSourceId(null);
      setPendingConnectionPoint(null);
      setSnappedConnectionTarget(null);
      return;
    }
    connectionCommittedRef.current = true;
    updateCanvas((current) => connectCanvasNodes(current, edge));
    dismissCanvasNotice();
    setPendingConnectionSourceId(null);
    setPendingConnectionPoint(null);
    setSnappedConnectionTarget(null);
  }, [canvas, pendingConnectionSourceId, updateCanvas]);

  const handleRemoveEdge = useCallback((edgeId: string) => {
    updateCanvas((current) => removeCanvasEdge(current, edgeId));
    setSelectedEdgeId(null);
    dismissCanvasNotice();
  }, [dismissCanvasNotice, updateCanvas]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    updateCanvas((current) => removeCanvasNode(current, nodeId));
    setSelectedEdgeId(null);
    dismissCanvasNotice();
    setDetailNodeId((current) => (current === nodeId ? null : current));
  }, [dismissCanvasNotice, updateCanvas]);

  const handleUpdateNodeContent = useCallback((nodeId: string, content: string) => {
    updateCanvas((current) => {
      const node = getProjectAgentCanvasNodeById(current, nodeId);
      if (!node) return current;
      return upsertCanvasNode(current, {
        ...node,
        asset: { ...(node.asset || { id: nodeId, name: pageMessages.defaults.text }), content },
      });
    });
  }, [pageMessages.defaults.text, updateCanvas]);

  const handleUpdateFeatureNodeConfig = useCallback((
    nodeId: string,
    config: Partial<ProjectAgentFeatureNodeConfig>
  ) => {
    updateCanvas((current) => {
      const node = getProjectAgentCanvasNodeById(current, nodeId);
      if (!node || !isProjectAgentFeatureNode(node.type)) return current;
      return upsertCanvasNode(current, {
        ...node,
        config: {
          ...(node.config || {}),
          ...config,
        },
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
        if (isProjectAgentFeatureNode(node.type)) return getProjectAgentCanvasNodeSize(node).height;
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
      showCanvasNotice(`Add a compatible feature node before connecting this ${assetType}.`);
      return;
    }

    connectionCommittedRef.current = false;
    dismissCanvasNotice();
    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    setPendingConnectionSourceId(nodeId);
    setPendingConnectionPoint(point);
    setSnappedConnectionTarget(point ? getSnappedConnectionTarget(nodeId, point) : null);
  }, [canvas, dismissCanvasNotice, getCanvasPointFromClient, getSnappedConnectionTarget, showCanvasNotice]);

  const buildNodeConnectedAssetsPayload = useCallback((nodeId: string) => {
    const inputs = getConnectedAssetNodeMap(canvas, nodeId);
    return {
      avatar: inputs.get('avatar')?.asset || null,
      product: inputs.get('product')?.asset || null,
      video: inputs.get('video')?.asset || null,
      text: inputs.get('text')?.asset || null,
    };
  }, [canvas]);

  const handleRunNode = useCallback(async (nodeId: string) => {
    const node = getProjectAgentCanvasNodeById(canvas, nodeId);
    if (!node || !isProjectAgentFeatureNode(node.type)) return;
    const connectedAssets = buildNodeConnectedAssetsPayload(nodeId);

    const preflightResponse = await fetch('/api/project-agent/canvas-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeType: node.type,
        mode: 'preflight',
        config: node.config,
        connectedAssets,
      }),
    });

    const preflightPayload = await preflightResponse.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      requiredCredits?: number;
      currentCredits?: number;
    };

    if (!preflightResponse.ok) {
      const requiredCredits = typeof preflightPayload.requiredCredits === 'number'
        ? preflightPayload.requiredCredits
        : null;
      const currentCredits = typeof preflightPayload.currentCredits === 'number'
        ? preflightPayload.currentCredits
        : null;
      const insufficientCreditsMessage = preflightPayload.code === 'INSUFFICIENT_CREDITS' && requiredCredits !== null
        ? currentCredits !== null
          ? `Insufficient credits. Need ${requiredCredits} credits, you have ${currentCredits}.`
          : `Insufficient credits. Need ${requiredCredits} credits.`
        : preflightPayload.error || 'Unable to start this run.';
      const errorInfo = getProjectAgentCanvasErrorInfo(insufficientCreditsMessage, {
        code: preflightPayload.code,
      });

      updateCanvas((current) => {
        const nextNode = getProjectAgentCanvasNodeById(current, nodeId);
        if (!nextNode) return current;
        return upsertCanvasNode(current, {
          ...nextNode,
          runtime: {
            ...(nextNode.runtime || {}),
            executionState: 'invalid',
            error: insufficientCreditsMessage,
            userFacingError: errorInfo.userFacingError,
            retryable: false,
            maintenanceBlocked: false,
            canStart: true,
            statusLabel: preflightPayload.code === 'INSUFFICIENT_CREDITS'
              ? 'Insufficient credits'
              : 'Unable to start',
          },
        });
      });
      return;
    }

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
          userFacingError: null,
          retryable: false,
          canStart: true,
          missingInputs: [],
          maintenanceBlocked: false,
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
        connectedAssets,
      }),
    });

    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      execution?: ProjectAgentCanvasExecutionStatus;
    };

    if (!response.ok || !payload.execution) {
      const errorInfo = getProjectAgentCanvasErrorInfo(payload.error || 'Run failed.', {
        code: payload.code,
      });
      updateCanvas((current) => {
        const nextNode = getProjectAgentCanvasNodeById(current, nodeId);
        if (!nextNode) return current;
        return upsertCanvasNode(current, {
          ...nextNode,
          runtime: {
            ...(nextNode.runtime || {}),
            executionState: 'failed',
            error: payload.error || 'Run failed.',
            userFacingError: errorInfo.userFacingError,
            retryable: errorInfo.retryable,
            maintenanceBlocked: errorInfo.maintenanceMode,
            canStart: false,
            statusLabel: errorInfo.maintenanceMode ? 'Maintenance' : 'Failed',
          },
        });
      });
      return;
    }

    updateNodeRuntime(nodeId, payload.execution);
  }, [buildNodeConnectedAssetsPayload, canvas, updateCanvas, updateNodeRuntime]);

  const handleRetryNode = useCallback(async (nodeId: string) => {
    const node = getProjectAgentCanvasNodeById(canvas, nodeId);
    if (!node || !isProjectAgentFeatureNode(node.type)) return;

    if (!node.runtime?.projectId || node.runtime.retryable === false) {
      await handleRunNode(nodeId);
      return;
    }

    const connectedAssets = buildNodeConnectedAssetsPayload(nodeId);

    updateCanvas((current) => {
      const nextNode = getProjectAgentCanvasNodeById(current, nodeId);
      if (!nextNode || !isProjectAgentFeatureNode(nextNode.type)) return current;
      return upsertCanvasNode(current, {
        ...nextNode,
        runtime: {
          ...(nextNode.runtime || {}),
          executionState: 'running',
          ...createQueuedExecutionStatus(nextNode.type),
          statusLabel: 'Retrying',
          userFacingError: null,
          error: null,
          retryable: false,
          maintenanceBlocked: false,
        },
      });
    });

    const response = await fetch('/api/project-agent/canvas-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeType: node.type,
        mode: 'retry',
        projectId: node.runtime.projectId,
        config: node.config,
        connectedAssets,
      }),
    });

    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      execution?: ProjectAgentCanvasExecutionStatus;
    };

    if (!response.ok || !payload.execution) {
      const errorInfo = getProjectAgentCanvasErrorInfo(payload.error || 'Retry failed.', {
        code: payload.code,
      });
      updateCanvas((current) => {
        const nextNode = getProjectAgentCanvasNodeById(current, nodeId);
        if (!nextNode) return current;
        return upsertCanvasNode(current, {
          ...nextNode,
          runtime: {
            ...(nextNode.runtime || {}),
            executionState: 'failed',
            error: payload.error || 'Retry failed.',
            userFacingError: errorInfo.userFacingError,
            retryable: errorInfo.retryable,
            maintenanceBlocked: errorInfo.maintenanceMode,
            canStart: false,
            statusLabel: errorInfo.maintenanceMode ? 'Maintenance' : 'Failed',
          },
        });
      });
      return;
    }

    updateNodeRuntime(nodeId, payload.execution);
  }, [buildNodeConnectedAssetsPayload, canvas, handleRunNode, updateCanvas, updateNodeRuntime]);

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

  const sidebarProps = useMemo(() => ({
    credits,
    creditsData,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    userImageUrl: user?.imageUrl,
  }), [credits, creditsData, user?.imageUrl, user?.primaryEmailAddress?.emailAddress]);

  const promptCommands = useMemo<PromptCommand[]>(() => {
    const avatarCommands = avatars.map((avatar) => ({
      id: `avatar:${avatar.id}`,
      label: avatar.name,
      chipLabel: `Avatar: ${avatar.name}`,
      prompt: `Add avatar "${quoteCommandAssetName(avatar.name)}" to the canvas.`,
      kind: 'asset' as const,
      groupLabel: 'Avatars',
      assetType: 'avatar' as const,
      assetId: avatar.id,
      imageUrl: avatar.imageUrl,
    }));

    const productCommands = products.map((product) => ({
      id: `product:${product.id}`,
      label: product.name,
      chipLabel: `Product: ${product.name}`,
      prompt: `Add product "${quoteCommandAssetName(product.name)}" to the canvas.`,
      kind: 'asset' as const,
      groupLabel: 'Products',
      assetType: 'product' as const,
      assetId: product.id,
      imageUrl: product.imageUrl,
    }));

    const videoCommands = videos.map((video) => ({
      id: `video:${video.id}`,
      label: video.name,
      chipLabel: `Video: ${video.name}`,
      prompt: `Add video "${quoteCommandAssetName(video.name)}" to the canvas.`,
      kind: 'asset' as const,
      groupLabel: 'Videos',
      assetType: 'video' as const,
      assetId: video.id,
      imageUrl: video.imageUrl,
    }));

    const functionCommands: PromptCommand[] = [
      {
        id: 'feature:video-clone',
        label: 'Video Clone',
        prompt: 'Add a Video Clone node to the canvas.',
        kind: 'feature',
        groupLabel: 'Functions',
        icon: Clapperboard,
      },
      {
        id: 'feature:avatar-ads',
        label: 'Avatar Ads',
        prompt: 'Add an Avatar Ads node to the canvas.',
        kind: 'feature',
        groupLabel: 'Functions',
        icon: User,
      },
      {
        id: 'feature:motion-clone',
        label: 'Motion Clone',
        prompt: 'Add a Motion Clone node to the canvas.',
        kind: 'feature',
        groupLabel: 'Functions',
        icon: Sparkles,
      },
      {
        id: 'text',
        label: 'Text',
        prompt: 'Add a Text node to the canvas.',
        kind: 'text',
        groupLabel: 'Functions',
        icon: Type,
      },
    ];

    return [
      ...avatarCommands,
      ...productCommands,
      ...videoCommands,
      ...functionCommands,
    ];
  }, [avatars, products, videos]);

  if (!isLoaded || isPageLoading) {
    return <FlowtraLoading />;
  }

  return (
    <div className="project-agent-page h-[100dvh] overflow-hidden text-black">
      <Sidebar {...sidebarProps} />

      <DashboardContentTransition className="dashboard-content-offset bg-background h-[100dvh] overflow-hidden min-h-0">
        <div className="h-full box-border min-h-0 p-3 md:py-3 md:pr-3 md:pl-0">
          <div className="h-full min-h-0">
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
                  onRetryFeatureNode={handleRetryNode}
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
                  onUpdateFeatureNodeConfig={handleUpdateFeatureNodeConfig}
                  onUpdateNodeContent={handleUpdateNodeContent}
                  pendingConnectionSourceId={pendingConnectionSourceId}
                  selectedEdgeId={selectedEdgeId}
                />
              </div>
              {canvasNotice ? (
                <div className="pointer-events-none absolute left-1/2 top-4 z-40 flex -translate-x-1/2 justify-center px-4">
                  <div className="pointer-events-auto flex max-w-[min(560px,calc(100vw-3rem))] items-start gap-3 rounded-full border border-amber-200 bg-[rgba(255,251,235,0.96)] px-4 py-3 text-sm text-amber-900 shadow-[0_16px_40px_rgba(15,15,15,0.12)] backdrop-blur-md animate-in fade-in zoom-in-95">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="line-clamp-2 min-w-0 flex-1 leading-5">{canvasNotice.message}</p>
                    <button
                      type="button"
                      onClick={dismissCanvasNotice}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-700 transition-colors hover:bg-amber-100"
                      aria-label="Dismiss canvas warning"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : null}
              <div data-canvas-ui="true" className="pointer-events-none absolute left-5 top-1/2 z-30 flex -translate-y-1/2 justify-center">
                <InsertToolbar
                  avatars={avatars}
                  products={products}
                  videos={videos}
                  orientation="vertical"
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
              <div data-canvas-ui="true" className="pointer-events-none absolute bottom-5 left-1/2 z-30 flex w-full -translate-x-1/2 justify-center px-6">
                <div className="pointer-events-auto relative w-full max-w-[720px]">
                  <PromptInputBox
                    value={draft}
                    onValueChange={setDraft}
                    onSend={(message) => {
                      void handleSend(message);
                    }}
                    isLoading={isStreaming}
                    placeholder="Describe what to add or change on the canvas..."
                    statusNote={statusNote}
                    commands={promptCommands}
                    onAssetCreateRequest={handlePromptAssetCreateRequest}
                    injectedCommandToken={injectedPromptCommandToken}
                    className="max-w-none opacity-90"
                  />
                  <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[16px] border border-white/35 bg-white/18 px-5 text-center shadow-[0_8px_20px_rgba(30,24,14,0.05)] backdrop-blur-[3px] backdrop-saturate-125">
                    <div className="flex items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                        <Construction className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#151515]">Agent mode is under development.</p>
                        <p className="mt-1 text-xs font-medium text-[#66615a]">Please use the draggable nodes on the left.</p>
                      </div>
                    </div>
                  </div>
                </div>
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
        onClose={() => {
          setShowCreateAvatarModal(false);
          if (pendingPromptAssetType === 'avatar') {
            setPendingPromptAssetType(null);
          }
        }}
        onAvatarCreated={handleAvatarCreated}
      />
      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => {
          setShowCreateProductModal(false);
          if (pendingPromptAssetType === 'product') {
            setPendingPromptAssetType(null);
          }
        }}
        onProductCreated={handleProductCreated}
      />
      <VideoImportModal
        isOpen={showVideoImportModal}
        onClose={() => {
          setShowVideoImportModal(false);
          if (pendingPromptAssetType === 'video') {
            setPendingPromptAssetType(null);
          }
        }}
        onImported={handleVideosImported}
        onError={(error) => setStatusNote(error)}
        onContinueInAgentFeatures={handleContinueInAgentFeatures}
      />
      <ProjectAgentWelcomeTourModal
        open={isWelcomeTourOpen}
        onOpenChange={setIsWelcomeTourOpen}
      />
    </div>
  );
}
