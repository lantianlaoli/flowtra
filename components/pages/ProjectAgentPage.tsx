'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowUp, Check, Loader2, MessageCircle, Plus } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import VideoAssetCard from '@/components/VideoAssetCard';
import VideoAssetDetailsModal from '@/components/VideoAssetDetailsModal';
import ClonePromptDraftStep, { type CloneDraftScene, type ClonePromptDraft } from '@/components/project-agent/ClonePromptDraftStep';
import CloneSceneReviewStep, {
  type CloneExecutionSegment,
  type CloneExecutionSegmentPrompt
} from '@/components/project-agent/CloneSceneReviewStep';
import { useCredits } from '@/contexts/CreditsContext';
import { createClient } from '@/lib/supabase/client';
import { getGenerationCost, type VideoModel } from '@/lib/constants';

interface SessionState {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';
  step?: string;
  cloneReferenceVideo?: {
    id: string;
    sourceType?: 'creator' | 'competitor_ad';
    sourceId?: string | null;
    name?: string | null;
    videoUrl?: string | null;
    cdnUrl?: string | null;
    language?: string | null;
    analysisSummary?: string | null;
    keyShots?: string[] | null;
    detectedCharacter?: string | null;
    detectedProduct?: string | null;
  };
  cloneReplacementDraft?: ClonePromptDraft;
  cloneExecution?: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'merging' | 'completed' | 'failed';
    model?: VideoModel;
    duration?: string;
    creditsCost?: number;
    error?: string | null;
    segments?: CloneExecutionSegment[];
  } | null;
  avatar?: { id: string; name: string; photoUrl: string };
  brand?: { id: string; name: string };
  product?: { id: string; name: string; brandId?: string | null; brandName?: string | null };
  language?: string;
  videoDurationSeconds?: number;
  videoAspectRatio?: '16:9' | '9:16';
  imageModel?: string;
  videoModel?: string;
  projectId?: string;
  generatedPrompts?: Record<string, unknown> | null;
  imagePrompt?: string | null;
  generatedImageUrl?: string | null;
}

type HistoryItem = {
  sessionId: string;
  title: string;
  updatedAt: string;
};

type CloneableVideoAsset = {
  id: string;
  platform?: string;
  video_url?: string | null;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  source_id?: string | null;
  source_name?: string | null;
  analysis_status?: string | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_error?: string | null;
  analysis_language?: string | null;
  source_type?: 'creator' | 'competitor_ad';
};

type CloneAvatarOption = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

type CloneProductOption = {
  id: string;
  name: string;
  photoUrl?: string | null;
  brandName?: string | null;
};

const SESSION_STORAGE_KEY = 'flowtra_project_agent_session_id';
const HISTORY_STORAGE_KEY = 'flowtra_project_agent_history_ids';

const createSessionId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const extractMessageText = (message: { parts?: Array<{ type?: string; text?: string }>; content?: string }) => {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part?.type === 'text')
      .map((part) => part.text ?? '')
      .join('');
  }
  return message.content ?? '';
};

const renderUIMessageText = (message: UIMessage) => {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
};

const dedupeConversationMessages = (messages: UIMessage[]) => {
  // Keep the latest payload for each id to avoid dropping streamed final text.
  const byIdMap = new Map<string, UIMessage>();
  messages.forEach((message) => {
    byIdMap.set(message.id, message);
  });
  const byId = Array.from(byIdMap.values());

  const collapsed: UIMessage[] = [];
  byId.forEach((message) => {
    const previous = collapsed[collapsed.length - 1];
    if (!previous) {
      collapsed.push(message);
      return;
    }

    if (previous.role === 'assistant' && message.role === 'assistant') {
      const prevText = renderUIMessageText(previous).trim();
      const currentText = renderUIMessageText(message).trim();
      if (prevText && prevText === currentText) {
        return;
      }
    }

    collapsed.push(message);
  });

  return collapsed;
};

const buildHistoryTitle = (messages: Array<{ role: string; parts?: Array<{ type?: string; text?: string }>; content?: string }>) => {
  const firstUser = messages.find((message) => message.role === 'user');
  if (!firstUser) return 'New conversation';
  const text = extractMessageText(firstUser).trim();
  if (!text) return 'New conversation';
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
};

const readHistoryIds = () => {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const writeHistoryIds = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(ids));
};

const normalizeStoredMessage = (message: unknown, index: number): UIMessage => {
  const raw = (message ?? {}) as {
    id?: string;
    role?: UIMessage['role'];
    parts?: Array<{ type?: string; text?: string }>;
    content?: string;
  };

  const textParts = Array.isArray(raw.parts)
    ? raw.parts
        .filter((part) => part?.type === 'text')
        .map((part) => ({ type: 'text' as const, text: part.text ?? '' }))
    : [];
  const parts = textParts.length > 0
    ? textParts
    : [{ type: 'text' as const, text: typeof raw.content === 'string' ? raw.content : '' }];
  const normalizedId = typeof raw.id === 'string' && raw.id.trim().length > 0
    ? raw.id
    : `session-${index}`;

  return {
    id: normalizedId,
    role: raw.role ?? 'assistant',
    parts
  };
};

const inferReferenceStructure = (analysis: Record<string, unknown> | null | undefined) => {
  if (!analysis || typeof analysis !== 'object') {
    return {
      summary: 'Reference video selected. Structure details are limited; continue with replacement selection.',
      keyShots: [] as string[],
      detectedCharacter: 'main character',
      detectedProduct: 'featured product'
    };
  }

  const shotsRaw = Array.isArray((analysis as { shots?: unknown }).shots)
    ? ((analysis as { shots?: Array<Record<string, unknown>> }).shots ?? [])
    : [];

  const keyShots = shotsRaw
    .slice(0, 3)
    .map((shot, index) => {
      const description =
        (typeof shot.shot_description === 'string' && shot.shot_description.trim()) ||
        (typeof shot.description === 'string' && shot.description.trim()) ||
        (typeof shot.action === 'string' && shot.action.trim()) ||
        '';
      if (!description) return '';
      return `Shot ${index + 1}: ${description}`;
    })
    .filter(Boolean);

  const allText = JSON.stringify(analysis).toLowerCase();
  const detectedCharacter =
    allText.includes('woman') ? 'woman' :
    allText.includes('female') ? 'female character' :
    allText.includes('man') ? 'man' :
    allText.includes('male') ? 'male character' :
    allText.includes('person') ? 'person' :
    'main character';

  const detectedProduct =
    allText.includes('phone stand') ? 'phone stand' :
    allText.includes('tripod') ? 'tripod/stand' :
    allText.includes('bottle') ? 'bottle product' :
    allText.includes('device') ? 'device product' :
    allText.includes('product') ? 'featured product' :
    'featured product';

  const summary =
    keyShots.length > 0
      ? `I parsed ${keyShots.length} key shots. The structure centers on a ${detectedCharacter} and a ${detectedProduct}.`
      : `I parsed the reference and identified a ${detectedCharacter} plus a ${detectedProduct} as the main replacement targets.`;

  return { summary, keyShots, detectedCharacter, detectedProduct };
};

const normalizeVideoModel = (raw: unknown): VideoModel => {
  if (raw === 'veo3' || raw === 'seedance_1_5_pro') return raw;
  return 'veo3_fast';
};

const sceneToSegmentPrompt = (scene: CloneDraftScene, fallbackLanguage: string): CloneExecutionSegmentPrompt => {
  const shots = typeof scene.videoPrompt === 'string'
    ? [{
        id: 1,
        time_range: '00:00 - 00:08',
        subject: scene.videoPrompt,
        context_environment: '',
        action: '',
        style: '',
        camera_motion_positioning: '',
        composition: '',
        ambiance_colour_lighting: '',
        audio: '',
        dialogue: '',
        language: fallbackLanguage
      }]
    : scene.videoPrompt.shots.map((shot, index) => ({
        id: shot.id || index + 1,
        time_range: shot.time_range || '00:00 - 00:08',
        subject: shot.subject || '',
        context_environment: shot.context_environment || '',
        action: shot.action || '',
        style: shot.style || '',
        camera_motion_positioning: shot.camera_motion_positioning || '',
        composition: shot.composition || '',
        ambiance_colour_lighting: shot.ambiance_colour_lighting || '',
        audio: shot.audio || '',
        dialogue: shot.dialogue || '',
        language: shot.language || fallbackLanguage
      }));

  return {
    first_frame_description: scene.imagePrompt || '',
    shots,
    is_continuation_from_prev: scene.sceneIndex > 1
  };
};

const mapStatusToClonePhase = (payload: Record<string, unknown>): 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'merging' | 'completed' | 'failed' => {
  const data = (payload.data && typeof payload.data === 'object') ? payload.data as Record<string, unknown> : {};
  const step = typeof payload.current_step === 'string' ? payload.current_step : '';
  const status = typeof payload.status === 'string' ? payload.status : '';

  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (step === 'awaiting_merge' || step === 'merging_segments') return 'merging';

  const segmentStatus = (data.segmentStatus && typeof data.segmentStatus === 'object')
    ? data.segmentStatus as Record<string, unknown>
    : null;
  const total = Number(segmentStatus?.total ?? 0);
  const framesReady = Number(segmentStatus?.framesReady ?? 0);
  const videosReady = Number(segmentStatus?.videosReady ?? 0);

  if (total > 0 && framesReady === total && videosReady < total) {
    return 'reviewing_frames';
  }

  if (
    step === 'generating_segment_videos' ||
    step === 'ready_for_video' ||
    step === 'generating_video' ||
    videosReady > 0
  ) {
    return 'generating_videos';
  }

  return 'generating_frames';
};

export default function ProjectAgentPage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();

  const [sessionId, setSessionId] = useState('');
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [pendingBaselineCount, setPendingBaselineCount] = useState(0);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [cloneableVideos, setCloneableVideos] = useState<CloneableVideoAsset[]>([]);
  const [isCloneableVideosLoading, setIsCloneableVideosLoading] = useState(false);
  const [showCloneableVideos, setShowCloneableVideos] = useState(false);
  const [awaitingCloneEntryReply, setAwaitingCloneEntryReply] = useState(false);
  const [cloneEntryReplyBaseline, setCloneEntryReplyBaseline] = useState(0);
  const [showCloneReplacementSelectors, setShowCloneReplacementSelectors] = useState(false);
  const [awaitingCloneStructureReply, setAwaitingCloneStructureReply] = useState(false);
  const [cloneStructureReplyBaseline, setCloneStructureReplyBaseline] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<CloneableVideoAsset | null>(null);
  const [showVideoDetails, setShowVideoDetails] = useState(false);
  const [cloneAvatarOptions, setCloneAvatarOptions] = useState<CloneAvatarOption[]>([]);
  const [cloneProductOptions, setCloneProductOptions] = useState<CloneProductOption[]>([]);
  const [isCloneOptionsLoading, setIsCloneOptionsLoading] = useState(false);
  const [selectedCloneAvatarId, setSelectedCloneAvatarId] = useState<string | null>(null);
  const [selectedCloneProductId, setSelectedCloneProductId] = useState<string | null>(null);
  const [isSubmittingCloneSelection, setIsSubmittingCloneSelection] = useState(false);
  const [isRegeneratingCloneDraft, setIsRegeneratingCloneDraft] = useState(false);
  const [isGeneratingCloneProject, setIsGeneratingCloneProject] = useState(false);
  const [isGeneratingFinalVideo, setIsGeneratingFinalVideo] = useState(false);
  const [regeneratingSegmentIndex, setRegeneratingSegmentIndex] = useState<number | null>(null);
  const [showClonePromptDraftStep, setShowClonePromptDraftStep] = useState(false);
  const [showCloneSceneReviewStep, setShowCloneSceneReviewStep] = useState(false);
  const [awaitingCloneDraftReply, setAwaitingCloneDraftReply] = useState(false);
  const [cloneDraftReplyBaseline, setCloneDraftReplyBaseline] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const isStreamingRef = useRef(false);

  const ensureHistoryTracked = useCallback((id: string, options?: { prependIfNew?: boolean }) => {
    const ids = readHistoryIds();
    if (ids.includes(id)) return;

    const prepend = options?.prependIfNew ?? false;
    const next = prepend ? [id, ...ids] : [...ids, id];
    writeHistoryIds(next.slice(0, 30));
  }, []);

  const refreshHistory = useCallback(async () => {
    const ids = readHistoryIds();
    if (ids.length === 0) {
      setHistoryItems([]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/project-agent/session?sessionId=${id}`, { cache: 'no-store' });
            if (!response.ok) return null;

            const payload = await response.json();
            const session = payload?.session;
            if (!session) return null;

            const sessionMessages = Array.isArray(session.messages) ? session.messages : [];
            return {
              sessionId: id,
              title: buildHistoryTitle(sessionMessages),
              updatedAt: session.updated_at || new Date().toISOString()
            } as HistoryItem;
          } catch {
            return null;
          }
        })
      );

      const resolvedMap = new Map(
        results
          .filter((item): item is HistoryItem => Boolean(item))
          .map((item) => [item.sessionId, item] as const)
      );

      const merged = ids.map((id) => (
        resolvedMap.get(id) ?? {
          sessionId: id,
          title: 'New conversation',
          updatedAt: new Date().toISOString()
        }
      ));

      setHistoryItems(merged);
      writeHistoryIds(merged.map((item) => item.sessionId));
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionId) return;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_STORAGE_KEY) : null;
    const nextId = stored || createSessionId();

    setSessionId(nextId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
    }
    ensureHistoryTracked(nextId, { prependIfNew: true });
  }, [sessionId, ensureHistoryTracked]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    clearError
  } = useChat({
    id: sessionId || undefined,
    transport: new DefaultChatTransport({
      api: '/api/project-agent/chat',
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          id,
          sessionId: id,
          message: messages[messages.length - 1]
        }
      })
    }),
    onFinish: () => {
      void refreshHistory();
    }
  });

  const isStreaming = status === 'submitted' || status === 'streaming';


  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/project-agent/session?sessionId=${sessionId}`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) {
          setSessionState(null);
          setMessages([]);
        }
        return;
      }

      const payload = await response.json();
      if (!payload?.session) return;

      setSessionState(payload.session.state || null);

      if (!isStreamingRef.current && Array.isArray(payload.session.messages)) {
        const normalizedMessages = payload.session.messages.map((message: unknown, index: number) =>
          normalizeStoredMessage(message, index)
        );
        setMessages(dedupeConversationMessages(normalizedMessages));
      }
    } catch (fetchError) {
      console.error('Failed to load agent session:', fetchError);
    }
  }, [sessionId, setMessages]);

  useEffect(() => {
    if (!sessionId) return;
    void fetchSession();
    void refreshHistory();
  }, [sessionId, fetchSession, refreshHistory]);

  useEffect(() => {
    if (!error) return;
    setStatusNote(error.message || 'Flowtra hit an error. Please retry.');
  }, [error]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (status === 'ready' && !error) {
      setStatusNote('');
    }
  }, [status, error]);

  useEffect(() => {
    if (!sessionState?.projectId) return;

    const supabase = createClient();
    const channel: RealtimeChannel = supabase
      .channel(`project-agent-${sessionState.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'avatar_ads_projects',
          filter: `id=eq.${sessionState.projectId}`
        },
        async () => {
          try {
            const response = await fetch(`/api/avatar-ads/${sessionState.projectId}/status`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload?.project) return;

            setSessionState((prev) => ({
              ...prev,
              step: payload.project.status,
              generatedPrompts: payload.project.generated_prompts ?? prev?.generatedPrompts ?? null,
              imagePrompt: payload.project.image_prompt ?? prev?.imagePrompt ?? null,
              generatedImageUrl: payload.project.generated_image_url ?? prev?.generatedImageUrl ?? null
            }));

            await fetch('/api/project-agent/session', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                statePatch: {
                  step: payload.project.status,
                  generatedPrompts: payload.project.generated_prompts ?? null,
                  imagePrompt: payload.project.image_prompt ?? null,
                  generatedImageUrl: payload.project.generated_image_url ?? null
                },
                projectId: sessionState.projectId
              })
            });
          } catch (syncError) {
            console.error('Failed to sync project status:', syncError);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, sessionState?.projectId]);

  const handleSubmit = useCallback((event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const next = draft.trim();
    if (!next || !sessionId || isStreaming) return;

    clearError();
    setStatusNote('');
    ensureHistoryTracked(sessionId);
    setPendingUserText(next);
    setPendingBaselineCount(messages.length);
    sendMessage({ text: next });
    setDraft('');
  }, [clearError, draft, ensureHistoryTracked, isStreaming, messages.length, sendMessage, sessionId]);

  const loadCloneReplacementOptions = useCallback(async () => {
    setIsCloneOptionsLoading(true);
    try {
      const [avatarsResponse, assetsResponse] = await Promise.all([
        fetch('/api/user-avatars', { cache: 'no-store' }),
        fetch('/api/assets', { cache: 'no-store' })
      ]);

      if (avatarsResponse.ok) {
        const avatarsPayload = await avatarsResponse.json();
        const avatarsRaw: Array<Record<string, unknown>> = Array.isArray(avatarsPayload?.avatars)
          ? avatarsPayload.avatars
          : [];
        const normalizedAvatars = avatarsRaw
          .filter((avatar) => typeof avatar.id === 'string')
          .map((avatar) => ({
            id: avatar.id as string,
            name:
              (typeof avatar.avatar_name === 'string' && avatar.avatar_name) ||
              (typeof avatar.file_name === 'string' && avatar.file_name) ||
              'Unnamed Avatar',
            photoUrl:
              (typeof avatar.primary_photo_url === 'string' && avatar.primary_photo_url) ||
              (typeof avatar.photo_url === 'string' && avatar.photo_url) ||
              null
          })) as CloneAvatarOption[];
        setCloneAvatarOptions(normalizedAvatars);
      }

      if (assetsResponse.ok) {
        const assetsPayload = await assetsResponse.json();
        const productsRaw: Array<Record<string, unknown>> = Array.isArray(assetsPayload?.products)
          ? assetsPayload.products
          : [];
        const normalizedProducts = productsRaw
          .filter((product) => typeof product.id === 'string')
          .map((product) => {
            const photos = Array.isArray(product.user_product_photos)
              ? (product.user_product_photos as Array<Record<string, unknown>>)
              : [];
            const firstPhoto = photos.find((photo) => typeof photo.photo_url === 'string');
            const brand = (product.brand && typeof product.brand === 'object')
              ? (product.brand as Record<string, unknown>)
              : null;

            return {
              id: product.id as string,
              name: (typeof product.product_name === 'string' && product.product_name) || 'Unnamed Product',
              photoUrl: (firstPhoto?.photo_url as string | undefined) ?? null,
              brandName: (brand && typeof brand.brand_name === 'string') ? brand.brand_name : null
            };
          }) as CloneProductOption[];
        setCloneProductOptions(normalizedProducts);
      }
    } catch (optionsError) {
      console.error('Failed to load clone replacement options:', optionsError);
    } finally {
      setIsCloneOptionsLoading(false);
    }
  }, []);

  const handleSelectCloneReference = useCallback(async (video: CloneableVideoAsset) => {
    if (!sessionId || isStreaming) return;

    const referenceName = video.source_name || video.description || `Video ${video.id.slice(0, 8)}`;
    const structure = inferReferenceStructure(video.analysis_result);
    const referencePatch = {
      intent: 'competitor_ugc_replication' as const,
      step: 'collecting',
      cloneReferenceVideo: {
        id: video.id,
        sourceType: video.source_type || 'creator',
        sourceId: video.source_id || video.id,
        name: video.source_name ?? null,
        videoUrl: video.video_url ?? null,
        cdnUrl: video.video_cdn_url ?? null,
        language: video.analysis_language ?? null,
        analysisSummary: structure.summary,
        keyShots: structure.keyShots,
        detectedCharacter: structure.detectedCharacter,
        detectedProduct: structure.detectedProduct
      },
      cloneReplacementDraft: {
        status: 'idle' as const,
        error: null,
        scenes: []
      },
      cloneExecution: null
    };

    setSessionState((prev) => ({
      ...(prev ?? {}),
      ...referencePatch
    }));
    setShowCloneableVideos(false);
    setAwaitingCloneEntryReply(false);
    setCloneEntryReplyBaseline(0);
    setShowCloneReplacementSelectors(false);
    setSelectedCloneAvatarId(null);
    setSelectedCloneProductId(null);
    setShowClonePromptDraftStep(false);
    setShowCloneSceneReviewStep(false);
    setAwaitingCloneDraftReply(false);
    setCloneDraftReplyBaseline(0);
    setAwaitingCloneStructureReply(true);
    setCloneStructureReplyBaseline(messages.length);

    void loadCloneReplacementOptions();

    try {
      await fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statePatch: referencePatch
        })
      });
    } catch (patchError) {
      console.error('Failed to persist selected clone reference:', patchError);
    }

    clearError();
    setStatusNote('');
    ensureHistoryTracked(sessionId);
    sendMessage({
      text: `I selected "${referenceName}" as the reference video for clone.`
    });
  }, [clearError, ensureHistoryTracked, isStreaming, loadCloneReplacementOptions, messages.length, sendMessage, sessionId]);

  const startNewChat = useCallback(() => {
    const nextId = createSessionId();
    setSessionId(nextId);
    setSessionState(null);
    setDraft('');
    setPendingUserText(null);
    setStatusNote('');
    setMessages([]);
    setShowCloneableVideos(false);
    setAwaitingCloneEntryReply(false);
    setCloneEntryReplyBaseline(0);
    setShowCloneReplacementSelectors(false);
    setShowClonePromptDraftStep(false);
    setShowCloneSceneReviewStep(false);
    setAwaitingCloneStructureReply(false);
    setAwaitingCloneDraftReply(false);
    setSelectedCloneAvatarId(null);
    setSelectedCloneProductId(null);
    setIsGeneratingCloneProject(false);
    setIsGeneratingFinalVideo(false);
    setRegeneratingSegmentIndex(null);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
    }
    ensureHistoryTracked(nextId, { prependIfNew: true });
    void refreshHistory();
  }, [ensureHistoryTracked, refreshHistory, setMessages]);

  const selectHistory = useCallback((targetSessionId: string) => {
    setSessionId(targetSessionId);
    setSessionState(null);
    setPendingUserText(null);
    setStatusNote('');
    setMessages([]);
    setShowCloneableVideos(false);
    setShowCloneReplacementSelectors(false);
    setShowClonePromptDraftStep(false);
    setShowCloneSceneReviewStep(false);
    setAwaitingCloneStructureReply(false);
    setAwaitingCloneDraftReply(false);
    setSelectedCloneAvatarId(null);
    setSelectedCloneProductId(null);
    setIsGeneratingCloneProject(false);
    setIsGeneratingFinalVideo(false);
    setRegeneratingSegmentIndex(null);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, targetSessionId);
    }
    ensureHistoryTracked(targetSessionId);
  }, [ensureHistoryTracked, setMessages]);

  const isReady = Boolean(sessionId);
  const displayMessages = useMemo(() => dedupeConversationMessages(messages), [messages]);
  const loadCloneableVideos = useCallback(async () => {
    setIsCloneableVideosLoading(true);
    try {
      const response = await fetch('/api/assets', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const videos: Array<Record<string, unknown>> = Array.isArray(payload?.videos) ? payload.videos : [];
      const normalized = videos
        .filter((video: Record<string, unknown>) => typeof video.id === 'string')
        .map((video: Record<string, unknown>) => ({
          id: video.id as string,
          platform: typeof video.platform === 'string' ? video.platform : undefined,
          video_url: typeof video.video_url === 'string' ? video.video_url : null,
          video_cdn_url: typeof video.video_cdn_url === 'string' ? video.video_cdn_url : null,
          cover_url: typeof video.cover_url === 'string' ? video.cover_url : null,
          description: typeof video.description === 'string' ? video.description : null,
          duration_seconds: typeof video.duration_seconds === 'number' ? video.duration_seconds : null,
          source_id: typeof video.source_id === 'string' ? video.source_id : null,
          source_name: typeof video.source_name === 'string' ? video.source_name : null,
          analysis_status: typeof video.analysis_status === 'string' ? video.analysis_status : null,
          analysis_result: (video.analysis_result && typeof video.analysis_result === 'object')
            ? (video.analysis_result as Record<string, unknown>)
            : null,
          analysis_error: typeof video.analysis_error === 'string' ? video.analysis_error : null,
          analysis_language: typeof video.analysis_language === 'string' ? video.analysis_language : null,
          source_type: video.source_type === 'competitor_ad' ? 'competitor_ad' : 'creator'
        })) as CloneableVideoAsset[];

      // Prioritize analyzed videos first, then keep latest imported order.
      normalized.sort((a, b) => {
        const aAnalyzed = a.analysis_result ? 1 : 0;
        const bAnalyzed = b.analysis_result ? 1 : 0;
        if (aAnalyzed !== bAnalyzed) return bAnalyzed - aAnalyzed;
        return 0;
      });

      setCloneableVideos(normalized);
    } catch (fetchError) {
      console.error('Failed to load cloneable videos:', fetchError);
    } finally {
      setIsCloneableVideosLoading(false);
    }
  }, []);

  const latestUserText = useMemo(() => {
    const lastUser = [...displayMessages].reverse().find((message) => message.role === 'user');
    return lastUser ? renderUIMessageText(lastUser).trim().toLowerCase() : '';
  }, [displayMessages]);

  const isCloneIntentTurn = useMemo(() => {
    if (!latestUserText) return false;
    return (
      latestUserText.includes('clone') ||
      latestUserText.includes('viral') ||
      latestUserText.includes('competitor') ||
      latestUserText.includes('ugc')
    );
  }, [latestUserText]);

  useEffect(() => {
    if (!isCloneIntentTurn) return;
    if (awaitingCloneEntryReply || showCloneableVideos) return;
    if (sessionState?.intent === 'competitor_ugc_replication' && sessionState?.cloneReferenceVideo?.id) return;
    setAwaitingCloneEntryReply(true);
    setCloneEntryReplyBaseline(displayMessages.length);
  }, [
    awaitingCloneEntryReply,
    displayMessages.length,
    isCloneIntentTurn,
    sessionState?.cloneReferenceVideo?.id,
    sessionState?.intent,
    showCloneableVideos
  ]);

  useEffect(() => {
    if (!awaitingCloneEntryReply) return;
    if (status !== 'ready') return;
    if (sessionState?.cloneReferenceVideo?.id) {
      setAwaitingCloneEntryReply(false);
      return;
    }

    const assistantReplies = displayMessages
      .slice(cloneEntryReplyBaseline)
      .filter((message) => message.role === 'assistant')
      .map((message) => renderUIMessageText(message).trim().toLowerCase())
      .filter(Boolean);

    if (assistantReplies.length === 0) return;

    const asksForReferenceVideo = assistantReplies.some((text) => (
      text.includes('reference video') ||
      text.includes('choose reference') ||
      text.includes('select one video') ||
      text.includes('select a video')
    ));

    if (asksForReferenceVideo) {
      setShowCloneableVideos(true);
      void loadCloneableVideos();
    }

    setAwaitingCloneEntryReply(false);
  }, [
    awaitingCloneEntryReply,
    cloneEntryReplyBaseline,
    displayMessages,
    loadCloneableVideos,
    sessionState?.cloneReferenceVideo?.id,
    status
  ]);

  useEffect(() => {
    const hasReference = Boolean(
      sessionState?.intent === 'competitor_ugc_replication' && sessionState?.cloneReferenceVideo?.id
    );

    if (!hasReference) {
      setShowCloneReplacementSelectors(false);
      setAwaitingCloneStructureReply(false);
      return;
    }

    setShowCloneableVideos(false);
    if (!awaitingCloneStructureReply) {
      const draftStatus = sessionState?.cloneReplacementDraft?.status;
      if (draftStatus && draftStatus !== 'idle') {
        return;
      }
      const hasAssistantReply = displayMessages.some(
        (message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0
      );
      if (hasAssistantReply) {
        setShowCloneReplacementSelectors(true);
      }
    }
  }, [
    awaitingCloneStructureReply,
    displayMessages,
    sessionState?.intent,
    sessionState?.cloneReferenceVideo?.id,
    sessionState?.cloneReplacementDraft?.status
  ]);

  useEffect(() => {
    if (!awaitingCloneStructureReply) return;
    if (status !== 'ready') return;

    const hasAssistantReplyAfterSelection = displayMessages
      .slice(cloneStructureReplyBaseline)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);

    if (!hasAssistantReplyAfterSelection) return;

    setShowCloneReplacementSelectors(true);
    setAwaitingCloneStructureReply(false);
  }, [awaitingCloneStructureReply, cloneStructureReplyBaseline, displayMessages, status]);

  useEffect(() => {
    if (!showCloneReplacementSelectors) return;
    if (cloneAvatarOptions.length === 0 || cloneProductOptions.length === 0) {
      void loadCloneReplacementOptions();
    }
  }, [showCloneReplacementSelectors, cloneAvatarOptions.length, cloneProductOptions.length, loadCloneReplacementOptions]);

  useEffect(() => {
    if (!sessionState?.avatar?.id) return;
    setSelectedCloneAvatarId(sessionState.avatar.id);
  }, [sessionState?.avatar?.id]);

  useEffect(() => {
    if (!sessionState?.product?.id) return;
    setSelectedCloneProductId(sessionState.product.id);
  }, [sessionState?.product?.id]);

  useEffect(() => {
    if (sessionState?.cloneReplacementDraft?.selectedAvatar?.id) {
      setSelectedCloneAvatarId(sessionState.cloneReplacementDraft.selectedAvatar.id);
    }
    if (sessionState?.cloneReplacementDraft?.selectedProduct?.id) {
      setSelectedCloneProductId(sessionState.cloneReplacementDraft.selectedProduct.id);
    }
  }, [sessionState?.cloneReplacementDraft?.selectedAvatar?.id, sessionState?.cloneReplacementDraft?.selectedProduct?.id]);

  useEffect(() => {
    const draftStatus = sessionState?.cloneReplacementDraft?.status;
    if (sessionState?.cloneExecution?.projectId) {
      setShowClonePromptDraftStep(false);
      return;
    }
    if (!draftStatus || draftStatus === 'idle') {
      setShowClonePromptDraftStep(false);
      return;
    }
    if (draftStatus === 'ready' && !awaitingCloneDraftReply) {
      setShowClonePromptDraftStep(true);
      return;
    }
    if (draftStatus === 'failed' && !awaitingCloneDraftReply) {
      setShowClonePromptDraftStep(true);
    }
  }, [awaitingCloneDraftReply, sessionState?.cloneExecution?.projectId, sessionState?.cloneReplacementDraft?.status]);

  useEffect(() => {
    if (!sessionState?.cloneExecution?.projectId) {
      setShowCloneSceneReviewStep(false);
      return;
    }
    setShowCloneSceneReviewStep(true);
  }, [sessionState?.cloneExecution?.projectId]);

  useEffect(() => {
    if (!awaitingCloneDraftReply) return;
    if (status !== 'ready') return;
    const hasAssistantReplyAfterDraft = displayMessages
      .slice(cloneDraftReplyBaseline)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
    if (!hasAssistantReplyAfterDraft) return;
    setShowClonePromptDraftStep(true);
    setAwaitingCloneDraftReply(false);
  }, [awaitingCloneDraftReply, cloneDraftReplyBaseline, displayMessages, status]);

  const hasPendingInMessages = useMemo(() => {
    if (!pendingUserText) return false;
    return displayMessages.slice(pendingBaselineCount).some((message) => (
      message.role === 'user' && renderUIMessageText(message).trim() === pendingUserText
    ));
  }, [displayMessages, pendingBaselineCount, pendingUserText]);

  useEffect(() => {
    if (!pendingUserText) return;
    if (hasPendingInMessages || status === 'ready') {
      setPendingUserText(null);
      setPendingBaselineCount(0);
    }
  }, [hasPendingInMessages, pendingUserText, status]);

  const requestCloneReplacementDraft = useCallback(async (params: { avatarId?: string; productId?: string }) => {
    if (!sessionId) {
      throw new Error('Session is missing.');
    }

    const response = await fetch('/api/project-agent/clone-replacement-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        avatarId: params.avatarId,
        productId: params.productId
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload?.success || !payload?.draft) {
      throw new Error(payload?.error || 'Failed to regenerate prompts.');
    }

    return payload.draft as ClonePromptDraft;
  }, [sessionId]);

  const fetchCloneExecutionStatus = useCallback(async (projectId: string) => {
    const response = await fetch(`/api/competitor-ugc-replication/${projectId}/status`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload?.data) {
      throw new Error(payload?.error || 'Failed to fetch clone execution status.');
    }

    const data = payload.data as Record<string, unknown>;
    const segmentsRaw = Array.isArray(data.segments) ? data.segments as Array<Record<string, unknown>> : [];
    const segments = segmentsRaw.map((segment) => ({
      segmentIndex: Number(segment.index ?? 0),
      status: typeof segment.status === 'string' ? segment.status : 'queued',
      firstFrameUrl: typeof segment.firstFrameUrl === 'string' ? segment.firstFrameUrl : null,
      videoUrl: typeof segment.videoUrl === 'string' ? segment.videoUrl : null,
      errorMessage: typeof segment.errorMessage === 'string' ? segment.errorMessage : null,
      prompt: (segment.prompt && typeof segment.prompt === 'object')
        ? segment.prompt as CloneExecutionSegmentPrompt
        : undefined
    })) as CloneExecutionSegment[];

    return {
      projectId,
      phase: mapStatusToClonePhase(payload as Record<string, unknown>),
      model: normalizeVideoModel(data.videoModel),
      duration: typeof data.videoDuration === 'string' ? data.videoDuration : undefined,
      creditsCost: typeof data.creditsUsed === 'number' ? data.creditsUsed : undefined,
      segments
    };
  }, []);

  const persistCloneState = useCallback(async (statePatch: Record<string, unknown>) => {
    if (!sessionId) return;
    await fetch('/api/project-agent/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, statePatch })
    });
  }, [sessionId]);

  const handleConfirmCloneSelections = useCallback(async () => {
    if (!sessionId || isStreaming || (!selectedCloneAvatarId && !selectedCloneProductId)) return;

    const selectedAvatar = selectedCloneAvatarId
      ? cloneAvatarOptions.find((item) => item.id === selectedCloneAvatarId)
      : undefined;
    const selectedProduct = selectedCloneProductId
      ? cloneProductOptions.find((item) => item.id === selectedCloneProductId)
      : undefined;
    if (selectedCloneAvatarId && !selectedAvatar) return;
    if (selectedCloneProductId && !selectedProduct) return;

    setIsSubmittingCloneSelection(true);
    setStatusNote('');
    setAwaitingCloneDraftReply(true);
    setCloneDraftReplyBaseline(messages.length);
    setShowCloneReplacementSelectors(false);
    setShowClonePromptDraftStep(false);

    const generatingDraft: ClonePromptDraft = {
      status: 'generating',
      error: null,
      selectedAvatar: selectedAvatar
        ? { id: selectedAvatar.id, name: selectedAvatar.name, photoUrl: selectedAvatar.photoUrl || null }
        : undefined,
      selectedProduct: selectedProduct
        ? {
            id: selectedProduct.id,
            name: selectedProduct.name,
            photoUrl: selectedProduct.photoUrl || null,
            brandName: selectedProduct.brandName || null
          }
        : undefined,
      scenes: []
    };

    const statePatch: Record<string, unknown> = {
      step: 'collecting',
      cloneReplacementDraft: generatingDraft
    };
    if (selectedAvatar) {
      statePatch.avatar = {
        id: selectedAvatar.id,
        name: selectedAvatar.name,
        photoUrl: selectedAvatar.photoUrl || ''
      };
    }
    if (selectedProduct) {
      statePatch.product = {
        id: selectedProduct.id,
        name: selectedProduct.name
      };
    }

    setSessionState((prev) => ({
      ...(prev ?? {}),
      ...statePatch
    }));

    try {
      await fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, statePatch })
      });

      const draftPayload = await requestCloneReplacementDraft({
        avatarId: selectedAvatar?.id,
        productId: selectedProduct?.id
      });

      setSessionState((prev) => ({
        ...(prev ?? {}),
        cloneReplacementDraft: draftPayload
      }));
    } catch (confirmError) {
      const errorMessage = confirmError instanceof Error ? confirmError.message : 'Failed to generate replacement prompts.';
      setStatusNote(errorMessage);
      setSessionState((prev) => ({
        ...(prev ?? {}),
        cloneReplacementDraft: {
          ...generatingDraft,
          status: 'failed',
          error: errorMessage
        }
      }));
    }

    clearError();
    ensureHistoryTracked(sessionId);
    const replacementSummary: string[] = [];
    if (selectedAvatar) replacementSummary.push(`avatar "${selectedAvatar.name}"`);
    if (selectedProduct) replacementSummary.push(`product "${selectedProduct.name}"`);
    const summaryText = replacementSummary.join(' and ');
    sendMessage({
      text: `I selected replacement ${summaryText} for this clone. Continue to the next step and keep the unselected part unchanged.`
    });
    setIsSubmittingCloneSelection(false);
  }, [
    clearError,
    cloneAvatarOptions,
    cloneProductOptions,
    ensureHistoryTracked,
    isStreaming,
    messages.length,
    requestCloneReplacementDraft,
    selectedCloneAvatarId,
    selectedCloneProductId,
    sendMessage,
    sessionId
  ]);

  const handleGenerateCloneProject = useCallback(async (scenes: CloneDraftScene[]) => {
    if (!sessionId || !user?.id || !sessionState?.cloneReferenceVideo?.id || !sessionState?.cloneReplacementDraft || isGeneratingCloneProject) {
      return;
    }

    const selectedProductId = sessionState.cloneReplacementDraft.selectedProduct?.id || selectedCloneProductId;
    const selectedProduct = selectedProductId
      ? cloneProductOptions.find((item) => item.id === selectedProductId)
      : null;

    if (!selectedProduct?.photoUrl) {
      setStatusNote('Please select a product with an image before generating.');
      return;
    }

    setIsGeneratingCloneProject(true);

    const model = normalizeVideoModel(sessionState.videoModel);
    const sceneCount = Math.max(1, scenes.length);
    const duration = String(sceneCount * 8);
    const generationCost = getGenerationCost(model, duration);

    const updatedDraft: ClonePromptDraft = {
      ...sessionState.cloneReplacementDraft,
      scenes
    };

    const initialSegments: CloneExecutionSegment[] = scenes.map((scene, index) => ({
      segmentIndex: index,
      status: 'queued',
      firstFrameUrl: null,
      videoUrl: null,
      prompt: sceneToSegmentPrompt(scene, sessionState.language || 'en')
    }));

    setSessionState((prev) => (
      prev
        ? {
            ...prev,
            cloneReplacementDraft: updatedDraft,
            cloneExecution: {
              projectId: '',
              phase: 'generating_frames',
              model,
              duration,
              creditsCost: generationCost,
              segments: initialSegments
            }
          }
        : prev
    ));
    setShowClonePromptDraftStep(false);
    setShowCloneSceneReviewStep(true);

    try {
      await persistCloneState({
        cloneReplacementDraft: updatedDraft,
        cloneExecution: {
          projectId: '',
          phase: 'generating_frames',
          model,
          duration,
          creditsCost: generationCost,
          segments: initialSegments
        }
      });

      const createPayload: Record<string, unknown> = {
        userId: user.id,
        imageUrl: selectedProduct.photoUrl,
        videoModel: model,
        videoAspectRatio: sessionState.videoAspectRatio || '9:16',
        videoDuration: duration,
        language: sessionState.language || 'en',
        shouldGenerateVideo: true
      };
      if (sessionState.cloneReferenceVideo.sourceType === 'competitor_ad') {
        createPayload.competitorAdId = sessionState.cloneReferenceVideo.sourceId || sessionState.cloneReferenceVideo.id;
      } else {
        createPayload.creatorSourceVideoId = sessionState.cloneReferenceVideo.sourceId || sessionState.cloneReferenceVideo.id;
      }

      const userMessage = 'Generate this clone now.';
      setPendingUserText(userMessage);
      setPendingBaselineCount(messages.length);
      setAwaitingCloneDraftReply(true);
      setCloneDraftReplyBaseline(messages.length);
      sendMessage({ text: userMessage });

      const createResponse = await fetch('/api/competitor-ugc-replication/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload)
      });
      const createResult = await createResponse.json();
      if (!createResponse.ok || !createResult?.success || !createResult?.projectId) {
        throw new Error(createResult?.error || 'Failed to start clone generation.');
      }

      const projectId = createResult.projectId as string;
      const nextExecution = await fetchCloneExecutionStatus(projectId);
      const mergedExecution = {
        ...nextExecution,
        creditsCost: typeof createResult.creditsUsed === 'number' ? createResult.creditsUsed : generationCost
      };

      setSessionState((prev) => (
        prev
          ? {
              ...prev,
              cloneExecution: mergedExecution
            }
          : prev
      ));

      await persistCloneState({
        cloneExecution: mergedExecution
      });

      setStatusNote('Frame generation started.');
    } catch (generateError) {
      const errorMessage = generateError instanceof Error ? generateError.message : 'Failed to start clone generation.';
      setStatusNote(errorMessage);
      setSessionState((prev) => (
        prev
          ? {
              ...prev,
              cloneExecution: {
                ...(prev.cloneExecution || {
                  projectId: '',
                  phase: 'failed',
                  segments: []
                }),
                phase: 'failed',
                error: errorMessage
              }
            }
          : prev
      ));
      setShowClonePromptDraftStep(true);
      setShowCloneSceneReviewStep(false);
    } finally {
      setIsGeneratingCloneProject(false);
    }
  }, [
    cloneProductOptions,
    fetchCloneExecutionStatus,
    isGeneratingCloneProject,
    messages.length,
    persistCloneState,
    selectedCloneProductId,
    sendMessage,
    sessionId,
    sessionState?.cloneReferenceVideo?.id,
    sessionState?.cloneReferenceVideo?.sourceId,
    sessionState?.cloneReferenceVideo?.sourceType,
    sessionState?.cloneReplacementDraft,
    sessionState?.language,
    sessionState?.videoAspectRatio,
    sessionState?.videoModel,
    user?.id
  ]);

  useEffect(() => {
    const projectId = sessionState?.cloneExecution?.projectId;
    const phase = sessionState?.cloneExecution?.phase;
    if (!projectId) return;
    if (phase === 'completed' || phase === 'failed') return;

    let cancelled = false;
    const sync = async () => {
      try {
        const nextExecution = await fetchCloneExecutionStatus(projectId);
        if (cancelled) return;
        setSessionState((prev) => prev ? { ...prev, cloneExecution: nextExecution } : prev);
      } catch {
        // Ignore intermittent polling failures.
      }
    };

    void sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fetchCloneExecutionStatus, sessionState?.cloneExecution?.phase, sessionState?.cloneExecution?.projectId]);

  const handleRegenerateCloneDraft = useCallback(async () => {
    if (!sessionId || !sessionState?.cloneReplacementDraft || isStreaming || isRegeneratingCloneDraft) return;
    const avatarId = sessionState.cloneReplacementDraft.selectedAvatar?.id || selectedCloneAvatarId || undefined;
    const productId = sessionState.cloneReplacementDraft.selectedProduct?.id || selectedCloneProductId || undefined;
    if (!avatarId && !productId) return;

    const regenerateMessage = 'Please regenerate this step with the same selections.';

    setIsRegeneratingCloneDraft(true);
    setPendingUserText(regenerateMessage);
    setPendingBaselineCount(messages.length);
    setAwaitingCloneDraftReply(true);
    setCloneDraftReplyBaseline(messages.length);
    sendMessage({ text: regenerateMessage });
    setSessionState((prev) => (
      prev
        ? {
            ...prev,
            cloneReplacementDraft: {
              ...prev.cloneReplacementDraft,
              status: 'generating',
              error: null,
              scenes: []
            }
          }
        : prev
    ));

    try {
      const draftPayload = await requestCloneReplacementDraft({ avatarId, productId });
      setSessionState((prev) => (
        prev
          ? {
              ...prev,
              cloneReplacementDraft: draftPayload
            }
          : prev
      ));
      setStatusNote('Regenerated successfully.');
    } catch (regenerateError) {
      const errorMessage = regenerateError instanceof Error ? regenerateError.message : 'Failed to regenerate. Please try again.';
      setStatusNote('Failed to regenerate. Please try again.');
      setSessionState((prev) => (
        prev
          ? {
              ...prev,
              cloneReplacementDraft: {
                ...(prev.cloneReplacementDraft || { status: 'failed', scenes: [] }),
                status: 'failed',
                error: errorMessage
              }
            }
          : prev
      ));
      console.error('Failed to regenerate prompts:', errorMessage);
    } finally {
      setIsRegeneratingCloneDraft(false);
    }
  }, [
    isRegeneratingCloneDraft,
    isStreaming,
    messages.length,
    requestCloneReplacementDraft,
    selectedCloneAvatarId,
    selectedCloneProductId,
    sendMessage,
    sessionId,
    sessionState?.cloneReplacementDraft
  ]);

  const handleRegenerateCloneSegmentFrame = useCallback(async (segmentIndex: number, prompt: CloneExecutionSegmentPrompt) => {
    if (!sessionId || !sessionState?.cloneExecution?.projectId) return;

    setRegeneratingSegmentIndex(segmentIndex);
    setStatusNote('');

    try {
      const response = await fetch(`/api/competitor-ugc-replication/${sessionState.cloneExecution.projectId}/segments/${segmentIndex}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regenerate: 'photo',
          prompt,
          productIds: sessionState.cloneReplacementDraft?.selectedProduct?.id ? [sessionState.cloneReplacementDraft.selectedProduct.id] : [],
          characterIds: sessionState.cloneReplacementDraft?.selectedAvatar?.id ? [sessionState.cloneReplacementDraft.selectedAvatar.id] : []
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to regenerate frame.');
      }

      const nextExecution = await fetchCloneExecutionStatus(sessionState.cloneExecution.projectId);
      setSessionState((prev) => prev ? { ...prev, cloneExecution: nextExecution } : prev);
      await persistCloneState({ cloneExecution: nextExecution });
      setStatusNote(`Scene ${segmentIndex + 1} frame regenerated.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate frame.';
      setStatusNote(errorMessage);
    } finally {
      setRegeneratingSegmentIndex(null);
    }
  }, [fetchCloneExecutionStatus, persistCloneState, sessionId, sessionState?.cloneExecution?.projectId, sessionState?.cloneReplacementDraft?.selectedAvatar?.id, sessionState?.cloneReplacementDraft?.selectedProduct?.id]);

  const handleGenerateFinalCloneVideo = useCallback(async () => {
    if (!sessionState?.cloneExecution?.projectId || isGeneratingFinalVideo) return;
    setIsGeneratingFinalVideo(true);
    setStatusNote('');

    try {
      const message = 'Start final video generation now.';
      setPendingUserText(message);
      setPendingBaselineCount(messages.length);
      sendMessage({ text: message });

      const response = await fetch(`/api/competitor-ugc-replication/${sessionState.cloneExecution.projectId}/start-video`, {
        method: 'POST'
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to start final video generation.');
      }

      const nextExecution = await fetchCloneExecutionStatus(sessionState.cloneExecution.projectId);
      const merged = { ...nextExecution, phase: 'generating_videos' as const };
      setSessionState((prev) => prev ? { ...prev, cloneExecution: merged } : prev);
      await persistCloneState({ cloneExecution: merged });
      setStatusNote('Final video generation started.');
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : 'Failed to start final video generation.');
    } finally {
      setIsGeneratingFinalVideo(false);
    }
  }, [fetchCloneExecutionStatus, isGeneratingFinalVideo, messages.length, persistCloneState, sendMessage, sessionState?.cloneExecution?.projectId]);

  const handleReselectCloneReplacements = useCallback(() => {
    setSessionState((prev) => prev ? { ...prev, cloneExecution: null } : prev);
    setShowClonePromptDraftStep(false);
    setShowCloneSceneReviewStep(false);
    setShowCloneReplacementSelectors(true);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    chatBottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const characterMentions = useMemo(() => cloneAvatarOptions.map((avatar) => ({
    id: avatar.id,
    label: avatar.name,
    imageUrl: avatar.photoUrl || null
  })), [cloneAvatarOptions]);

  const productMentions = useMemo(() => cloneProductOptions.map((product) => ({
    id: product.id,
    label: product.name,
    imageUrl: product.photoUrl || null
  })), [cloneProductOptions]);

  const cloneGenerationCost = useMemo(() => {
    const scenes = sessionState?.cloneReplacementDraft?.scenes;
    if (!scenes?.length) return null;
    const model = normalizeVideoModel(sessionState?.videoModel);
    return getGenerationCost(model, String(Math.max(1, scenes.length) * 8));
  }, [sessionState?.cloneReplacementDraft?.scenes, sessionState?.videoModel]);

  const canGenerateFinalVideo = useMemo(() => {
    const segments = sessionState?.cloneExecution?.segments;
    if (!segments?.length) return false;
    return segments.every((segment) => segment.status === 'first_frame_ready' || Boolean(segment.firstFrameUrl));
  }, [sessionState?.cloneExecution?.segments]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [sessionId, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [displayMessages, pendingUserText, isStreaming, scrollToBottom]);

  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f7f7f5]">
      <Sidebar
        credits={credits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="dashboard-content-offset h-screen overflow-hidden">
        <div className="h-full p-4 md:p-6 lg:p-8">
          <div className="grid h-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
            <aside className="h-full rounded-2xl border border-[#e6e6e4] bg-[#fbfbfa] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e6e6e4]">
                <div className="text-sm font-semibold text-[#1f1f1e]">History</div>
                <button
                  type="button"
                  onClick={startNewChat}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d9d9d7] bg-white px-2.5 text-xs font-medium text-[#1f1f1e] hover:bg-[#f3f3f2]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              </div>

              <div className="h-[calc(100%-57px)] overflow-y-auto p-2 space-y-1">
                {isHistoryLoading && historyItems.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-[#787876]">Loading history...</div>
                ) : historyItems.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-[#787876]">No conversations yet.</div>
                ) : (
                  historyItems.map((item) => (
                    <button
                      key={item.sessionId}
                      type="button"
                      onClick={() => selectHistory(item.sessionId)}
                      className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors ${
                        item.sessionId === sessionId
                          ? 'bg-white border-[#1f1f1e]'
                          : 'bg-transparent border-transparent hover:bg-white hover:border-[#e6e6e4]'
                      }`}
                    >
                      <div className="text-[13px] text-[#1f1f1e] font-medium truncate">{item.title}</div>
                      <div className="text-[11px] text-[#9b9b98] mt-0.5">
                        {new Date(item.updatedAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="h-full rounded-2xl border border-[#e6e6e4] bg-[#fbfbfa] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e6e6e4]">
                <div className="flex items-center gap-2 text-[#1f1f1e]">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Flowtra Agent</span>
                </div>
                {statusNote ? <span className="text-xs text-[#787876]">{statusNote}</span> : null}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={sessionId || 'empty-session'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    {displayMessages.map((message) => {
                      const messageText = renderUIMessageText(message).trim();
                      if (message.role === 'assistant' && !messageText) return null;
                      return (
                      <div
                        key={message.id}
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                          message.role === 'user'
                            ? 'ml-auto bg-[#0f0f0f] text-white'
                            : 'bg-[#efefed] text-[#1f1f1e]'
                        }`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
                            li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            code: ({ children }) => (
                              <code className="rounded bg-black/10 px-1 py-0.5 text-xs">{children}</code>
                            )
                          }}
                        >
                          {messageText}
                        </ReactMarkdown>
                      </div>
                    );})}

                    {pendingUserText && !hasPendingInMessages && (
                      <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ml-auto bg-[#0f0f0f] text-white">
                        {pendingUserText}
                      </div>
                    )}

                    {isStreaming && (
                      <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm bg-[#efefed] text-[#787876]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Flowtra is thinking...</span>
                        </div>
                      </div>
                    )}

                    {showCloneableVideos && (
                      <div className="w-full max-w-full lg:max-w-[56%] rounded-2xl border border-[#e6e6e4] bg-white p-4 lg:max-h-[68vh] lg:overflow-y-auto">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#1f1f1e]">Step 1: Choose Reference Video</p>
                            <p className="text-xs text-[#787876]">Select one video from Assets first. Product selection comes later.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void loadCloneableVideos()}
                            className="rounded-lg border border-[#d9d9d7] bg-white px-2.5 py-1.5 text-xs text-[#1f1f1e] hover:bg-[#f3f3f2]"
                            disabled={isCloneableVideosLoading}
                          >
                            {isCloneableVideosLoading ? 'Refreshing...' : 'Refresh'}
                          </button>
                        </div>

                        {isCloneableVideosLoading && cloneableVideos.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                            Loading your video assets...
                          </div>
                        ) : cloneableVideos.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                            No videos found in Assets. Import a video first, then ask to clone.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {cloneableVideos.map((video) => (
                              <VideoAssetCard
                                key={video.id}
                                video={video}
                                compact
                                onViewDetails={(asset) => {
                                  setSelectedVideo(asset as CloneableVideoAsset);
                                  setShowVideoDetails(true);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {showCloneReplacementSelectors && (
                      <div className="w-full max-w-full lg:max-w-[56%] rounded-2xl border border-[#e6e6e4] bg-white p-4 space-y-4">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 2</p>
                          <p className="text-sm font-medium text-[#4f4f4d]">Replace Character & Product</p>
                        </div>

                        {isCloneOptionsLoading ? (
                          <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                            Loading avatar and product options...
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[#1f1f1e] uppercase tracking-wide">Choose Avatar</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {cloneAvatarOptions.map((avatar) => (
                                  <button
                                    key={avatar.id}
                                    type="button"
                                    onClick={() => setSelectedCloneAvatarId(avatar.id)}
                                    className={`rounded-lg border p-2 text-left transition-colors ${selectedCloneAvatarId === avatar.id ? 'border-[#0f0f0f] bg-[#f3f3f2]' : 'border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                  >
                                    <div className="w-full aspect-square rounded-md overflow-hidden bg-[#efefed] mb-1.5">
                                      {avatar.photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatar.photoUrl} alt={avatar.name} className="w-full h-full object-cover" />
                                      ) : null}
                                    </div>
                                    <p className="text-[11px] font-medium text-[#1f1f1e] truncate">{avatar.name}</p>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[#1f1f1e] uppercase tracking-wide">Choose Product</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {cloneProductOptions.map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => setSelectedCloneProductId(product.id)}
                                    className={`rounded-lg border p-2 text-left transition-colors ${selectedCloneProductId === product.id ? 'border-[#0f0f0f] bg-[#f3f3f2]' : 'border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                  >
                                    <div className="w-full aspect-square rounded-md overflow-hidden bg-[#efefed] mb-1.5">
                                      {product.photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                                      ) : null}
                                    </div>
                                    <p className="text-[11px] font-medium text-[#1f1f1e] truncate">{product.name}</p>
                                    {product.brandName ? (
                                      <p className="text-[10px] text-[#787876] truncate">{product.brandName}</p>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleConfirmCloneSelections}
                              disabled={(!selectedCloneAvatarId && !selectedCloneProductId) || isStreaming || isSubmittingCloneSelection}
                              className="w-full rounded-lg bg-[#0f0f0f] text-white text-sm font-medium py-2.5 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                            >
                              {isSubmittingCloneSelection ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              {isSubmittingCloneSelection ? 'Submitting...' : 'Confirm Replacements'}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {showClonePromptDraftStep && sessionState?.cloneReplacementDraft ? (
                      <ClonePromptDraftStep
                        draft={sessionState.cloneReplacementDraft}
                        characterMentions={characterMentions}
                        productMentions={productMentions}
                        onGenerate={handleGenerateCloneProject}
                        onRegenerate={handleRegenerateCloneDraft}
                        onReselect={sessionState.cloneReplacementDraft.status === 'failed' ? handleReselectCloneReplacements : undefined}
                        generationCost={cloneGenerationCost}
                        isGenerating={isGeneratingCloneProject}
                        isRegenerating={isRegeneratingCloneDraft}
                      />
                    ) : null}
                    {showCloneSceneReviewStep && sessionState?.cloneExecution ? (
                      <CloneSceneReviewStep
                        execution={sessionState.cloneExecution}
                        characterMentions={characterMentions}
                        productMentions={productMentions}
                        onRegenerateFrame={handleRegenerateCloneSegmentFrame}
                        onGenerateFinalVideo={handleGenerateFinalCloneVideo}
                        isGeneratingFinalVideo={isGeneratingFinalVideo}
                        canGenerateFinalVideo={canGenerateFinalVideo}
                        regeneratingSegmentIndex={regeneratingSegmentIndex}
                      />
                    ) : null}
                    <div ref={chatBottomRef} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="border-t border-[#e6e6e4] px-4 py-4 md:px-6">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask Flowtra what to build next..."
                    className="flex-1 min-h-11 rounded-xl border border-[#d9d9d7] bg-white px-4 text-sm text-[#1f1f1e] placeholder:text-[#9b9b98] focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                    disabled={!isReady || isStreaming}
                  />
                  <button
                    type="submit"
                    disabled={!isReady || isStreaming || !draft.trim()}
                    aria-label="Send message"
                    className="min-h-11 min-w-11 rounded-xl bg-[#0f0f0f] text-white inline-flex items-center justify-center disabled:opacity-50"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>

      <VideoAssetDetailsModal
        isOpen={showVideoDetails}
        onClose={() => setShowVideoDetails(false)}
        video={selectedVideo}
        size="compact"
        cloneActionLabel="Select This Video"
        onUseForClone={(video) => handleSelectCloneReference(video as CloneableVideoAsset)}
      />
    </div>
  );
}
