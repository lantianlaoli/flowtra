'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AlertTriangle, ArrowUpRight, ChevronDown, Clapperboard, Coins, History, Image as ImageIcon, Loader2, Lock, MessageCircle, Package, Plus, RefreshCw, Search, Sparkles, User, Video as VideoIcon } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import VideoAssetCard from '@/components/VideoAssetCard';
import VideoAssetDetailsModal from '@/components/VideoAssetDetailsModal';
import MotionCloneEditorFormColumn from '@/components/motion-clone/MotionCloneEditorFormColumn';
import MotionCloneEditorSplitPane from '@/components/motion-clone/MotionCloneEditorSplitPane';
import AvatarWorkspaceEditor from '@/components/project-agent/AvatarWorkspaceEditor';
import { type CloneDraftScene, type ClonePromptDraft } from '@/components/project-agent/ClonePromptDraftStep';
import CloneMergedVideoReviewStep from '@/components/project-agent/CloneMergedVideoReviewStep';
import {
  type CloneExecutionSegment,
  type CloneExecutionSegmentPrompt
} from '@/components/project-agent/CloneSceneReviewStep';
import CloneSceneWorkspaceStep, {
  type WorkspaceScene
} from '@/components/project-agent/CloneSceneWorkspaceStep';
import { useCredits } from '@/contexts/CreditsContext';
import {
  requestNotificationPermissionIfNeeded,
  sendBrowserNotification
} from '@/lib/browser-notifications';
import type { UserAvatar, UserProduct } from '@/lib/supabase';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getMotionCloneGenerationCost,
  normalizeMotionCloneQuality,
  type VideoModel
} from '@/lib/constants';
import {
  getPrimaryCloneSelection,
  hasExplicitCloneAvatarSelectionState,
  hasExplicitCloneProductSelectionState,
  normalizeCloneSelections
} from '@/lib/project-agent/clone-selection';
import {
  normalizeProjectAgentVideoModel,
} from '@/lib/project-agent/video-model';
import {
  getProjectAgentInputPlaceholder,
  getProjectAgentPromptChips
} from '@/lib/project-agent/prompt-chips';
import { serializeProjectAgentCloneShot } from '@/lib/project-agent/clone-prompt-schema';
import {
  resolveProjectAgentCloneMergedVideoUrl,
  shouldShowProjectAgentCloneMergedReview,
} from '@/lib/project-agent/clone-execution';
import {
  buildMotionClonePromptDrafts,
  inferMotionCloneStage,
  inferMotionCloneReferenceContext,
} from '@/lib/project-agent/motion-clone-execution';
import type {
  ProjectAgentMotionCloneStage,
  ProjectAgentMotionCloneExecution,
  ProjectAgentMotionCloneReferenceVideo,
  ProjectAgentMotionCloneSelection
} from '@/lib/project-agent/motion-clone-execution';
import { isStartVideoGenerationCommand } from '@/lib/project-agent/clone-workflow-control';
import {
  isCloneFlowEffectivelyFinished,
  isNextCloneIntentMessage
} from '@/lib/project-agent/next-clone-intent';
import { buildWorkspaceScenes } from '@/lib/project-agent/workspace-scenes';
import {
  type AvatarProjectLike,
  type AvatarSceneLike,
  buildProjectAgentAvatarDraft,
  buildProjectAgentAvatarExecution,
  inferProjectAgentAvatarStage,
  normalizeProjectAgentAvatarStage,
  type ProjectAgentAvatarDraft,
  type ProjectAgentAvatarExecution,
  type ProjectAgentAvatarStage
} from '@/lib/project-agent/avatar-agent';
import { buildAvatarGeneratedPrompts } from '@/lib/project-agent/avatar-script-planning';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';
import { buildTypedMentionToken, MENTION_TOKEN_REGEX, parseMentionToken } from '@/lib/prompt-mention-tokens';

interface SessionState {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_clone';
  step?: string;
  avatarStage?: ProjectAgentAvatarStage;
  avatarSelection?: {
    avatar?: { id: string; name: string; photoUrl: string } | null;
    product?: { id: string; name: string; photoUrl?: string | null } | null;
    durationSeconds?: number;
    aspectRatio?: '16:9' | '9:16';
    language?: string;
  } | null;
  avatarDraft?: ProjectAgentAvatarDraft | null;
  avatarExecution?: ProjectAgentAvatarExecution | null;
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
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
    model?: VideoModel;
    duration?: string;
    creditsCost?: number;
    error?: string | null;
    mergedVideoUrl?: string | null;
    segments?: CloneExecutionSegment[];
  } | null;
  motionClone?: ProjectAgentMotionCloneExecution | null;
  avatar?: { id: string; name: string; photoUrl: string } | null;
  product?: { id: string; name: string } | null;
  customDialogue?: string;
  language?: string;
  videoDurationSeconds?: number;
  videoAspectRatio?: '16:9' | '9:16';
  videoModel?: VideoModel;
  projectId?: string;
  generatedPrompts?: Record<string, unknown> | null;
  pendingUpdatedPrompts?: Record<string, unknown> | null;
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

type MotionReferenceVideoAsset = ProjectAgentMotionCloneReferenceVideo & {
  platform?: string;
  stats?: Record<string, unknown> | null;
  source_id?: string | null;
  source_name?: string | null;
  source_type?: 'creator' | 'competitor_ad';
  analysisStatus?: string | null;
  analysisResult?: Record<string, unknown> | null;
  analysisError?: string | null;
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
};

type CloneAvatarSelection = NonNullable<ClonePromptDraft['selectedAvatar']>;
type CloneProductSelection = NonNullable<ClonePromptDraft['selectedProduct']>;

const LEGACY_MOTION_CLONE_PROMPT_REGEX = /appears in place of|match the original creator-video structure|preserve the same shot logic and beats|preserve the exact motion,\s*pacing,\s*rhythm,\s*and camera movement from the reference video/i;

const inferMotionCloneSelectionNamesFromPrompts = (...prompts: Array<string | null | undefined>) => {
  const labels: string[] = [];

  prompts.forEach((prompt) => {
    if (!prompt) return;
    for (const match of prompt.matchAll(MENTION_TOKEN_REGEX)) {
      const label = parseMentionToken(match[0])?.label?.trim();
      if (!label || labels.includes(label)) continue;
      labels.push(label);
    }
  });

  return {
    avatarName: labels[0] || '',
    productName: labels[1] || ''
  };
};

const buildNextMotionCloneState = (
  current: ProjectAgentMotionCloneExecution | null | undefined,
  patch: Partial<ProjectAgentMotionCloneExecution>
): ProjectAgentMotionCloneExecution => {
  const next = {
    ...(current ?? {
      stage: 'reference_selection' as const,
      phase: 'idle' as const
    }),
    ...patch
  };

  const stage = inferMotionCloneStage({
    explicitStage: patch.stage ?? next.stage ?? null,
    referenceVideo: patch.referenceVideo ?? next.referenceVideo ?? null,
    selectedAvatar: patch.selectedAvatar ?? next.selectedAvatar ?? null,
    phase: patch.phase ?? next.phase ?? null,
    previewImageUrl: patch.previewImageUrl ?? next.previewImageUrl ?? null,
    outputVideoUrl: patch.outputVideoUrl ?? next.outputVideoUrl ?? null,
  });

  const expectedAvatarToken = next.selectedAvatar?.name
    ? buildTypedMentionToken({ type: 'character', label: next.selectedAvatar.name })
    : '';
  const expectedProductToken = next.selectedProduct?.name
    ? buildTypedMentionToken({ type: 'product', label: next.selectedProduct.name })
    : '';
  const existingPhotoPrompt = next.photoPrompt || '';
  const existingVideoPrompt = next.videoPrompt || '';
  const promptsUseLegacyMotionCloneTemplate = (
    LEGACY_MOTION_CLONE_PROMPT_REGEX.test(existingPhotoPrompt) ||
    LEGACY_MOTION_CLONE_PROMPT_REGEX.test(existingVideoPrompt)
  );
  const promptsNeedMentionRefresh = (
    (expectedAvatarToken && (!existingPhotoPrompt.includes(expectedAvatarToken) || !existingVideoPrompt.includes(expectedAvatarToken))) ||
    (expectedProductToken && (!existingPhotoPrompt.includes(expectedProductToken) || !existingVideoPrompt.includes(expectedProductToken)))
  );

  const shouldRefreshPrompts = (
    Boolean(next.selectedAvatar?.name) &&
    (
      patch.selectedAvatar !== undefined ||
      patch.selectedProduct !== undefined ||
      !Boolean(next.promptsInitialized) ||
      !next.photoPrompt ||
      !next.videoPrompt ||
      promptsUseLegacyMotionCloneTemplate ||
      promptsNeedMentionRefresh
    )
  );

  if (shouldRefreshPrompts) {
    const drafts = buildMotionClonePromptDrafts({
      avatarName: next.selectedAvatar?.name,
      productName: next.selectedProduct?.name,
      referenceVideo: next.referenceVideo ?? null,
    });
    next.photoPrompt = drafts.photoPrompt;
    next.videoPrompt = drafts.videoPrompt;
    next.promptsInitialized = true;
  } else if (patch.selectedAvatar !== undefined && !next.selectedAvatar?.name) {
    next.photoPrompt = null;
    next.videoPrompt = null;
    next.promptsInitialized = false;
  }

  next.stage = stage;

  return next;
};

const SESSION_STORAGE_KEY = 'flowtra_project_agent_session_id';
const HISTORY_STORAGE_KEY = 'flowtra_project_agent_history_ids';
const MAX_CLONE_MULTI_SELECT = 8;
const THINKING_MESSAGES = [
  'Thinking this through carefully...',
  'Almost there, polishing the details...',
  'Aligning the best approach for you...',
  'Working on a stronger result for this step...',
  'Refining visuals and logic together...'
];
const PROJECT_AGENT_TUTORIAL_EMBED_URL = 'https://www.youtube.com/embed/FUkzZvssJTY?rel=0';

const createSessionId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readCurrentSessionId = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
};

const writeCurrentSessionId = (sessionId: string) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
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

export const hasVisibleAssistantReplyAfterLatestUserTurn = (messages: UIMessage[]) => {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user' && renderUIMessageText(message).trim().length > 0) {
      lastUserIndex = index;
      break;
    }
  }

  if (lastUserIndex < 0) return false;

  return messages
    .slice(lastUserIndex + 1)
    .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
};

const hasAssistantReplyAfterBaseline = (messages: UIMessage[], baselineCount: number) => {
  // `0` is a valid baseline for the first turn in a fresh session.
  if (baselineCount < 0) return false;
  return messages
    .slice(baselineCount)
    .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
};

const isWorkflowCommandMessage = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /^regenerate\s+(scene|shot|frame)\s+#?\d+/.test(normalized) ||
    /^regenerate\s+#?\d+\s+(scene|shot|frame)/.test(normalized) ||
    /^start\s+(video|videos?)\s+generation/.test(normalized) ||
    /^start\s+(generate|generating)\s+(video|videos?)/.test(normalized) ||
    /^generate\s+(video|videos?)/.test(normalized) ||
    /^merge\s+(clone\s+)?videos?/.test(normalized) ||
    /^finali[sz]e\s+(clone\s+)?videos?/.test(normalized)
  );
};

const isReferenceSelectionMessage = (text: string) => {
  const normalized = text.trim();
  return /^i selected ".*" as the reference video for clone\.$/i.test(normalized);
};

const findLatestReferenceSelectionIndex = (messages: UIMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;
    if (isReferenceSelectionMessage(renderUIMessageText(message))) {
      return index;
    }
  }
  return -1;
};

const isCloneIntentMessage = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (isReferenceSelectionMessage(normalized)) return false;
  if (isWorkflowCommandMessage(normalized)) return false;
  return /\b(clone|viral|competitor|ugc)\b/i.test(normalized);
};

const findLatestCloneIntentIndex = (messages: UIMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;
    if (isCloneIntentMessage(renderUIMessageText(message))) {
      return index;
    }
  }
  return -1;
};

const extractRegenerateSceneIndex = (text: string): number | null => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  const match = normalized.match(
    /regenerate\s+(?:scene|shot|frame)\s*#?\s*(\d{1,2})|regenerate\s*#?\s*(\d{1,2})\s*(?:scene|shot|frame)/i
  );
  if (!match) return null;
  const value = Number(match[1] || match[2]);
  if (!Number.isFinite(value) || value < 1) return null;
  return value;
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

    if (previous.role === message.role) {
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

const removeTrailingDuplicateUserMessages = (messages: UIMessage[], text: string) => {
  const normalizedTarget = text.trim();
  if (!normalizedTarget) return messages;

  const next = [...messages];
  while (next.length > 0) {
    const lastMessage = next[next.length - 1];
    if (lastMessage.role !== 'user') {
      break;
    }
    const lastText = renderUIMessageText(lastMessage).trim();
    if (lastText !== normalizedTarget) {
      break;
    }
    next.pop();
  }

  return next;
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

const normalizeVideoModel = (
  raw: unknown,
  intent?: SessionState['intent']
): VideoModel => {
  return normalizeProjectAgentVideoModel(raw, 'kling_3', intent);
};

const syncAvatarSelectionFromSession = (state: SessionState | null | undefined): NonNullable<SessionState['avatarSelection']> => ({
  avatar: state?.avatarSelection?.avatar ?? state?.avatar ?? null,
  product: state?.avatarSelection?.product ?? (state?.product ? { ...state.product } : null),
  durationSeconds: state?.avatarSelection?.durationSeconds ?? state?.videoDurationSeconds ?? 16,
  aspectRatio: state?.avatarSelection?.aspectRatio ?? state?.videoAspectRatio ?? '9:16',
  language: state?.avatarSelection?.language ?? state?.language ?? 'en'
});

const workspacePromptToDraftScene = (scene: WorkspaceScene): CloneDraftScene => ({
  sceneIndex: scene.sceneIndex,
  imagePrompt: scene.imagePrompt,
  isContinuation: scene.sceneIndex > 1 ? Boolean(scene.isContinuation) : false,
  sourceSummary: scene.sourceSummary ?? null,
  videoPrompt: {
    shots: scene.shots.map((shot, index) => serializeProjectAgentCloneShot(shot, index, shot.language || 'en'))
  }
});

const mapStatusToClonePhase = (payload: Record<string, unknown>): 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed' => {
  const data = (payload.data && typeof payload.data === 'object') ? payload.data as Record<string, unknown> : {};
  const step = typeof payload.current_step === 'string' ? payload.current_step : '';
  const status = typeof payload.status === 'string' ? payload.status : '';
  const mergeTaskId = typeof data.mergeTaskId === 'string' ? data.mergeTaskId : '';

  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (step === 'merging_segments' || Boolean(mergeTaskId)) return 'merging';
  if (step === 'awaiting_merge' || status === 'awaiting_merge') return 'awaiting_merge';

  const segmentStatus = (data.segmentStatus && typeof data.segmentStatus === 'object')
    ? data.segmentStatus as Record<string, unknown>
    : null;
  const segmentList = Array.isArray(segmentStatus?.segments)
    ? segmentStatus.segments as Array<Record<string, unknown>>
    : [];
  const hasFailedSegment = segmentList.some((segment) => (
    typeof segment?.status === 'string' && segment.status === 'failed'
  ));
  if (hasFailedSegment) return 'failed';

  const total = Number(segmentStatus?.total ?? 0);
  const framesReady = Number(segmentStatus?.framesReady ?? 0);
  const videosReady = Number(segmentStatus?.videosReady ?? 0);
  const hasInFlightVideoGeneration = segmentList.some((segment) => (
    typeof segment?.status === 'string' && segment.status === 'generating_video'
  ));

  if (
    step === 'generating_video' ||
    hasInFlightVideoGeneration
  ) {
    return 'generating_videos';
  }

  if (step === 'generating_segment_videos') {
    // If no segment-level in-flight video status exists, prefer the actual segment snapshot
    // instead of keeping a stale project-level "generating" step.
    if (hasInFlightVideoGeneration || total === 0) {
      return 'generating_videos';
    }
  }

  if (total > 0 && framesReady === total && videosReady < total) {
    return 'reviewing_frames';
  }

  if (step === 'ready_for_video' && total > 0) {
    return 'reviewing_frames';
  }

  return 'generating_frames';
};

const clonePhaseRank = (phase?: SessionState['cloneExecution'] extends { phase: infer P } ? P : string) => {
  switch (phase) {
    case 'failed':
      return -1;
    case 'idle':
      return 0;
    case 'generating_frames':
      return 1;
    case 'reviewing_frames':
      return 2;
    case 'generating_videos':
      return 3;
    case 'merging':
      return 4;
    case 'completed':
      return 5;
    default:
      return 0;
  }
};

const shouldNotifyClonePhaseTransition = (
  previous: SessionState['cloneExecution'] extends { phase: infer P } ? P : string | undefined,
  next: SessionState['cloneExecution'] extends { phase: infer P } ? P : string | undefined
) => {
  if (!next || previous === next) return false;
  if (next === 'completed' || next === 'failed') return true;
  if (!previous) return true;
  return clonePhaseRank(next) > clonePhaseRank(previous);
};

const cloneExecutionSignalScore = (execution?: SessionState['cloneExecution'] | null) => {
  if (!execution?.segments?.length) return 0;
  const segmentScore = execution.segments.reduce((acc, segment) => {
    const status = segment.status || '';
    const hasFirstFrame = Boolean(segment.firstFrameUrl);
    const hasVideo = Boolean(segment.videoUrl);
    if (hasVideo || status === 'video_ready') return acc + 4;
    if (hasFirstFrame || status === 'first_frame_ready') return acc + 2;
    if (status === 'generating_first_frame' || status === 'generating_video') return acc + 1;
    return acc;
  }, 0);
  if (execution.mergedVideoUrl) return segmentScore + 8;
  return segmentScore;
};

const shouldKeepLocalCloneExecution = (
  localExecution?: SessionState['cloneExecution'] | null,
  incomingExecution?: SessionState['cloneExecution'] | null
) => {
  if (!localExecution) return false;
  if (!incomingExecution) return true;

  const localProjectId = localExecution.projectId || '';
  const incomingProjectId = incomingExecution.projectId || '';

  // Different project means server moved on to a new execution; accept incoming.
  if (localProjectId && incomingProjectId && localProjectId !== incomingProjectId) {
    return false;
  }

  // Keep local execution if server snapshot briefly drops project id.
  if (localProjectId && !incomingProjectId) {
    return true;
  }

  // If server reports an explicit per-segment regeneration/in-progress transition,
  // accept it even when aggregate signal score temporarily decreases.
  const localByIndex = new Map(
    (localExecution.segments || []).map((segment) => [segment.segmentIndex, segment])
  );
  const incomingHasExplicitRegeneration = (incomingExecution.segments || []).some((segment) => {
    const incomingStatus = segment.status || '';
    if (incomingStatus !== 'generating_first_frame' && incomingStatus !== 'generating_video') {
      return false;
    }
    const localSegment = localByIndex.get(segment.segmentIndex);
    if (!localSegment) return false;
    const localStatus = localSegment.status || '';
    return (
      localStatus === 'first_frame_ready' ||
      localStatus === 'video_ready' ||
      Boolean(localSegment.firstFrameUrl) ||
      Boolean(localSegment.videoUrl)
    );
  });
  if (incomingHasExplicitRegeneration) {
    return false;
  }

  // If server reports an explicit failure for a segment that was previously pending/in-progress
  // locally, always accept incoming so the UI surfaces the real error immediately.
  const incomingHasExplicitFailure = (incomingExecution.segments || []).some((segment) => {
    const incomingStatus = segment.status || '';
    if (incomingStatus !== 'failed') return false;
    const localSegment = localByIndex.get(segment.segmentIndex);
    if (!localSegment) return true;
    const localStatus = localSegment.status || '';
    return (
      localStatus === 'queued' ||
      localStatus === 'pending_first_frame' ||
      localStatus === 'awaiting_prev_first_frame' ||
      localStatus === 'generating_first_frame' ||
      localStatus === 'generating_video'
    );
  });
  if (incomingHasExplicitFailure) {
    return false;
  }

  const localPhase = clonePhaseRank(localExecution.phase);
  const incomingPhase = clonePhaseRank(incomingExecution.phase);

  // Sticky protection: once video generation starts locally, do not roll back to
  // frame-review phases unless incoming snapshot has explicit video-level signal.
  if (
    localExecution.phase === 'generating_videos' &&
    (incomingExecution.phase === 'generating_frames' || incomingExecution.phase === 'reviewing_frames')
  ) {
    const incomingHasVideoSignal = Boolean(
      incomingExecution.segments?.some((segment) => (
        segment.status === 'generating_video' ||
        segment.status === 'video_ready' ||
        Boolean(segment.videoUrl)
      ))
    );
    // Only keep local state if the incoming snapshot is clearly incomplete.
    const incomingHasSegments = (incomingExecution.segments?.length ?? 0) > 0;
    if (!incomingHasVideoSignal && !incomingHasSegments) {
      return true;
    }
  }

  if (localPhase !== incomingPhase) {
    return localPhase > incomingPhase;
  }

  const localScore = cloneExecutionSignalScore(localExecution);
  const incomingScore = cloneExecutionSignalScore(incomingExecution);
  if (localScore !== incomingScore) {
    return localScore > incomingScore;
  }

  const localSegments = localExecution.segments?.length ?? 0;
  const incomingSegments = incomingExecution.segments?.length ?? 0;
  if (localSegments !== incomingSegments) {
    return localSegments > incomingSegments;
  }

  return false;
};

const mergeCloneExecutionWithLocal = (
  localExecution?: SessionState['cloneExecution'] | null,
  incomingExecution?: SessionState['cloneExecution'] | null
): SessionState['cloneExecution'] | null | undefined => {
  if (!incomingExecution) return incomingExecution;
  if (!localExecution) return incomingExecution;

  const localProjectId = localExecution.projectId || '';
  const incomingProjectId = incomingExecution.projectId || '';
  if (localProjectId && incomingProjectId && localProjectId !== incomingProjectId) {
    return incomingExecution;
  }

  const localByIndex = new Map(
    (localExecution.segments || []).map((segment) => [segment.segmentIndex, segment])
  );
  const incomingByIndex = new Map(
    (incomingExecution.segments || []).map((segment) => [segment.segmentIndex, segment])
  );

  const mergedSegments = Array.from(incomingByIndex.values()).map((incomingSegment) => {
    const localSegment = localByIndex.get(incomingSegment.segmentIndex);
    if (!localSegment) return incomingSegment;

    const incomingStatus = incomingSegment.status || '';

    return {
      ...incomingSegment,
      firstFrameTaskId: incomingSegment.firstFrameTaskId
        ?? (localSegment.firstFrameTaskId ?? null),
      // Keep previous media URLs when server snapshot is transient/incomplete.
      // This avoids frame-card flicker during regeneration polling.
      firstFrameUrl: incomingSegment.firstFrameUrl
        ?? (localSegment.firstFrameUrl ?? null),
      videoUrl: incomingSegment.videoUrl
        ?? (incomingStatus === 'generating_video' ? null : (localSegment.videoUrl ?? null)),
      prompt: incomingSegment.prompt ?? localSegment.prompt
    };
  });

  const mergedByIndex = new Map(mergedSegments.map((segment) => [segment.segmentIndex, segment]));
  for (const localSegment of localByIndex.values()) {
    if (!mergedByIndex.has(localSegment.segmentIndex)) {
      mergedByIndex.set(localSegment.segmentIndex, localSegment);
    }
  }

  return {
    ...incomingExecution,
    mergedVideoUrl: incomingExecution.mergedVideoUrl ?? localExecution.mergedVideoUrl ?? null,
    segments: Array.from(mergedByIndex.values()).sort((a, b) => a.segmentIndex - b.segmentIndex)
  };
};

export default function ProjectAgentPage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const supabase = useSupabaseBrowserClient();
  const [selectedVideoModel, setSelectedVideoModel] = useState<VideoModel>('kling_3');

  const [sessionId, setSessionId] = useState('');
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [pendingBaselineCount, setPendingBaselineCount] = useState(0);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryPopoverOpen, setIsHistoryPopoverOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [cloneableVideos, setCloneableVideos] = useState<CloneableVideoAsset[]>([]);
  const [isCloneableVideosLoading, setIsCloneableVideosLoading] = useState(false);
  const [showCloneableVideos, setShowCloneableVideos] = useState(false);
  const [awaitingCloneEntryReply, setAwaitingCloneEntryReply] = useState(false);
  const [cloneEntryReplyBaseline, setCloneEntryReplyBaseline] = useState(0);
  const [handledCloneIntentUserMessageId, setHandledCloneIntentUserMessageId] = useState<string | null>(null);
  const [showCloneReplacementSelectors, setShowCloneReplacementSelectors] = useState(false);
  const [awaitingCloneStructureReply, setAwaitingCloneStructureReply] = useState(false);
  const [cloneStructureReplyBaseline, setCloneStructureReplyBaseline] = useState(0);
  const [cloneStructureReplyReady, setCloneStructureReplyReady] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CloneableVideoAsset | null>(null);
  const [showVideoDetails, setShowVideoDetails] = useState(false);
  const [cloneAvatarOptions, setCloneAvatarOptions] = useState<CloneAvatarOption[]>([]);
  const [cloneProductOptions, setCloneProductOptions] = useState<CloneProductOption[]>([]);
  const [isCloneOptionsLoading, setIsCloneOptionsLoading] = useState(false);
  const [selectedCloneAvatarIds, setSelectedCloneAvatarIds] = useState<string[]>([]);
  const [selectedCloneProductIds, setSelectedCloneProductIds] = useState<string[]>([]);
  const [isGeneratingCloneProject, setIsGeneratingCloneProject] = useState(false);
  const [awaitingCloneDraftReply, setAwaitingCloneDraftReply] = useState(false);
  const [cloneDraftReplyBaseline, setCloneDraftReplyBaseline] = useState(0);
  const [retryableUserMessageId, setRetryableUserMessageId] = useState<string | null>(null);
  const [motionCloneVideos, setMotionCloneVideos] = useState<MotionReferenceVideoAsset[]>([]);
  const [motionCloneAvatars, setMotionCloneAvatars] = useState<UserAvatar[]>([]);
  const [motionCloneProducts, setMotionCloneProducts] = useState<UserProduct[]>([]);
  const [isMotionCloneAssetsLoading, setIsMotionCloneAssetsLoading] = useState(false);
  const [motionPhotoPrompt, setMotionPhotoPrompt] = useState('');
  const [motionVideoPrompt, setMotionVideoPrompt] = useState('');
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const historyPopoverRef = useRef<HTMLDivElement | null>(null);
  const isStreamingRef = useRef(false);
  const lastPersistedMessagesSignatureRef = useRef('');
  const draftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalCloneDraftEditAtRef = useRef(0);
  const pendingCloneSelectionPersistRef = useRef<Promise<void> | null>(null);
  const latestCloneDraftRef = useRef<ClonePromptDraft | null>(null);
  const motionClonePromptPersistTimerRef = useRef<number | null>(null);
  const latestSessionStateRef = useRef<SessionState | null>(null);
  const pendingCloneDraftPersistRef = useRef<Promise<void> | null>(null);
  const prevAvatarPhaseRef = useRef<ProjectAgentAvatarExecution['phase'] | null>(null);
  const prevClonePhaseRef = useRef<SessionState['cloneExecution'] extends { phase: infer P } ? P : string | null>(null);
  const notificationPermissionRequestedRef = useRef(false);

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
    const stored = readCurrentSessionId();
    const nextId = stored || createSessionId();

    setIsSessionReady(false);
    setSessionId(nextId);
    writeCurrentSessionId(nextId);
    ensureHistoryTracked(nextId, { prependIfNew: true });
  }, [sessionId, ensureHistoryTracked]);

  useEffect(() => {
    if (!sessionId) return;
    trackEvent(ANALYTICS_EVENTS.project_agent_session_started, {
      feature: 'project_agent',
      surface: 'project_agent_page',
      session_id: sessionId,
    });
  }, [sessionId]);

  const ensureSessionExists = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId) return;
    try {
      const response = await fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: targetSessionId })
      });
      if (!response.ok) {
        console.error(
          '[Project Agent] Failed to pre-create session:',
          response.status,
          response.statusText,
          await response.clone().text()
        );
      }
    } catch (error) {
      console.error('[Project Agent] Failed to pre-create session:', error);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setIsSessionReady(false);
    void (async () => {
      await ensureSessionExists(sessionId);
      setIsSessionReady(true);
    })();
  }, [ensureSessionExists, sessionId]);

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
      fetch: async (input, init) => {
        try {
          const response = await fetch(input, init);
          if (!response.ok) {
            console.error(
              '[Project Agent] Chat request failed:',
              response.status,
              response.statusText,
              await response.clone().text()
            );
          }
          return response;
        } catch (error) {
          console.error('[Project Agent] Chat request network error:', error);
          throw error;
        }
      },
      prepareSendMessagesRequest: ({ id, messages }) => {
        const latestSessionState = latestSessionStateRef.current ?? sessionState;
        const draftSelection = latestCloneDraftRef.current ?? latestSessionState?.cloneReplacementDraft;
        const statePatch: Record<string, unknown> = {};
        statePatch.videoModel = 'kling_3';
        const hasExplicitAvatarSelection = hasExplicitCloneAvatarSelectionState(draftSelection);
        const hasExplicitProductSelection = hasExplicitCloneProductSelectionState(draftSelection);

        if (latestSessionState?.avatar && !hasExplicitAvatarSelection) {
          statePatch.avatar = latestSessionState.avatar;
        }

        if (latestSessionState?.product && !hasExplicitProductSelection) {
          statePatch.product = latestSessionState.product;
        }

        const selectedAvatars = normalizeCloneSelections(
          draftSelection?.selectedAvatars,
          draftSelection?.selectedAvatar
        );
        const selectedProducts = normalizeCloneSelections(
          draftSelection?.selectedProducts,
          draftSelection?.selectedProduct
        );
        if (draftSelection && (hasExplicitAvatarSelection || hasExplicitProductSelection || selectedAvatars.length > 0 || selectedProducts.length > 0)) {
          statePatch.cloneReplacementDraft = {
            status: draftSelection.status ?? 'idle',
            planStatus: draftSelection.planStatus ?? 'collecting',
            confirmation: draftSelection.confirmation ?? null,
            error: draftSelection.error ?? null,
            scenes: Array.isArray(draftSelection.scenes) ? draftSelection.scenes : [],
            sceneAssignments: Array.isArray(draftSelection.sceneAssignments) ? draftSelection.sceneAssignments : [],
            selectedAvatars,
            selectedAvatar: getPrimaryCloneSelection(selectedAvatars),
            selectedProducts,
            selectedProduct: getPrimaryCloneSelection(selectedProducts)
          };
        } else if (latestSessionState?.avatar || latestSessionState?.product) {
          const fallbackSelectedAvatars = latestSessionState?.avatar
            ? [{
                id: latestSessionState.avatar.id,
                name: latestSessionState.avatar.name,
                photoUrl: latestSessionState.avatar.photoUrl || null
              }]
            : [];
          const fallbackSelectedProducts = latestSessionState?.product
            ? [{
                id: latestSessionState.product.id,
                name: latestSessionState.product.name,
                photoUrl: null
              }]
            : [];
          statePatch.cloneReplacementDraft = {
            status: 'idle',
            planStatus: 'collecting',
            confirmation: null,
            error: null,
            scenes: [],
            sceneAssignments: [],
            selectedAvatars: fallbackSelectedAvatars,
            selectedAvatar: getPrimaryCloneSelection(fallbackSelectedAvatars),
            selectedProducts: fallbackSelectedProducts,
            selectedProduct: getPrimaryCloneSelection(fallbackSelectedProducts)
          };
        }

        return {
          body: {
            id,
            sessionId: id,
            message: messages[messages.length - 1],
            ...(Object.keys(statePatch).length > 0 ? { statePatch } : {})
          }
        };
      }
    }),
    onFinish: () => {
      void refreshHistory();
    },
    onError: (chatError) => {
      const errorMessage = chatError instanceof Error ? chatError.message : String(chatError ?? '');
      console.error('[Project Agent] Chat transport failed:', chatError);
      setPendingUserText(null);
      setPendingBaselineCount(0);
      const lastUser = [...messages].reverse().find((message) => message.role === 'user');
      if (lastUser?.id) {
        setRetryableUserMessageId(lastUser.id);
      }
      setStatusNote(
        /failed to fetch|networkerror|load failed|abort/i.test(errorMessage)
          ? 'The message failed in the browser before reaching the server. Please retry.'
          : (errorMessage || 'Flowgen hit an error. Please retry.')
      );
    }
  });

  const isStreaming = status === 'submitted' || status === 'streaming';

  const hasUnansweredUserTurnInStream = useMemo(() => {
    const visibleMessages = dedupeConversationMessages(messages);
    let lastUserIndex = -1;
    let lastAssistantIndex = -1;
    visibleMessages.forEach((message, index) => {
      if (message.role === 'user' && renderUIMessageText(message).trim().length > 0) {
        lastUserIndex = index;
      }
      if (message.role === 'assistant' && renderUIMessageText(message).trim().length > 0) {
        lastAssistantIndex = index;
      }
    });
    return lastUserIndex > lastAssistantIndex;
  }, [messages]);

  const sendLocked = Boolean(
    pendingUserText ||
    isStreaming ||
    awaitingCloneEntryReply ||
    awaitingCloneStructureReply ||
    awaitingCloneDraftReply ||
    isGeneratingCloneProject ||
    hasUnansweredUserTurnInStream
  );

  const resetLocalCloneSurfaceForNextReference = useCallback(() => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const nextState = {
        ...prev,
        intent: 'competitor_ugc_replication' as const,
        cloneReferenceVideo: undefined,
        cloneReplacementDraft: undefined,
        cloneExecution: null,
        pendingMergeConfirmation: null,
        projectId: undefined,
        avatar: null,
        product: null
      };
      latestSessionStateRef.current = nextState;
      latestCloneDraftRef.current = null;
      return nextState;
    });
    setShowCloneableVideos(false);
    setShowCloneReplacementSelectors(false);
    setAwaitingCloneStructureReply(false);
    setCloneStructureReplyReady(false);
    setCloneStructureReplyBaseline(0);
    setAwaitingCloneDraftReply(false);
    setCloneDraftReplyBaseline(0);
    setSelectedCloneAvatarIds([]);
    setSelectedCloneProductIds([]);
    setRetryableUserMessageId(null);
  }, []);

  const sendMessageSafely = useCallback(async (text: string) => {
    try {
      const shouldResetForNextClone = (
        isNextCloneIntentMessage(text) &&
        isCloneFlowEffectivelyFinished({
          phase: sessionState?.cloneExecution?.phase,
          mergedVideoUrl: sessionState?.cloneExecution?.mergedVideoUrl
        })
      );

      if (shouldResetForNextClone) {
        resetLocalCloneSurfaceForNextReference();
        setAwaitingCloneEntryReply(true);
        setCloneEntryReplyBaseline(dedupeConversationMessages(messages).length);
        setHandledCloneIntentUserMessageId(null);
      }

      trackEvent(ANALYTICS_EVENTS.project_agent_message_sent, {
        feature: 'project_agent',
        surface: 'project_agent_page',
        session_id: sessionId || undefined,
      });
      await sendMessage({ text });
      return true;
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError ?? '');
      console.error('[Project Agent] Failed to send chat message:', sendError);
      if (/failed to fetch|networkerror|load failed|abort/i.test(message)) {
        setStatusNote('The message failed in the browser before reaching the server. Please retry.');
      }
      return false;
    }
  }, [messages, resetLocalCloneSurfaceForNextReference, sendMessage, sessionId, sessionState?.cloneExecution?.mergedVideoUrl, sessionState?.cloneExecution?.phase]);

  const requestBrowserNotificationPermissionOnce = useCallback(() => {
    if (notificationPermissionRequestedRef.current) return;
    notificationPermissionRequestedRef.current = true;
    void requestNotificationPermissionIfNeeded();
  }, []);

  const maybeRequestNotificationPermissionOnUserAction = useCallback((text: string) => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return;

    const likelyGenerationStart = (
      normalized === 'generate this clone now.' ||
      isStartVideoGenerationCommand(text) ||
      /\b(generate|start|render|create)\b[\s\w-]{0,24}\b(image|images|video|videos)\b/.test(normalized)
    );

    if (likelyGenerationStart) {
      requestBrowserNotificationPermissionOnce();
    }
  }, [requestBrowserNotificationPermissionOnce]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/project-agent/session?sessionId=${sessionId}`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) {
          setSessionState(null);
        }
        return;
      }

      const payload = await response.json();
      if (!payload?.session) return;
      const incomingState = payload.session.state || null;

      setSessionState((prev) => {
        if (!incomingState) return null;
        if (!prev) {
          const nextState = {
            ...incomingState,
            videoModel: 'kling_3' as const
          };
          if (nextState.motionClone) {
            nextState.motionClone = buildNextMotionCloneState(nextState.motionClone, {});
          }
          nextState.avatarSelection = syncAvatarSelectionFromSession(nextState);
          nextState.avatarStage = inferProjectAgentAvatarStage({
            explicitStage: nextState.avatarStage,
            hasAvatar: Boolean(nextState.avatarSelection.avatar?.id),
            hasDraft: Boolean(nextState.avatarDraft?.scenes?.length),
            hasCover: Boolean(nextState.avatarDraft?.coverImageUrl || nextState.generatedImageUrl),
            projectStatus: nextState.step,
            currentStep: nextState.step,
            hasExecution: Boolean(nextState.avatarExecution?.projectId || nextState.projectId)
          });
          return nextState;
        }

        const localDraft = prev.cloneReplacementDraft;
        const incomingDraft = incomingState.cloneReplacementDraft;
        const hasVeryRecentLocalDraftEdit = Date.now() - lastLocalCloneDraftEditAtRef.current < 3500;
        const hasPendingDraftPersist = Boolean(draftPersistTimerRef.current);
        const hasPendingSelectionPersist = Boolean(pendingCloneSelectionPersistRef.current);

        const shouldPreserveLocalCloneDraft = Boolean(
          localDraft &&
          incomingDraft &&
          localDraft.status === 'ready' &&
          incomingDraft.status === 'ready' &&
          (hasVeryRecentLocalDraftEdit || hasPendingDraftPersist)
        );

        const shouldPreserveLocalCloneSelections = Boolean(
          localDraft &&
          incomingDraft &&
          (hasVeryRecentLocalDraftEdit || hasPendingSelectionPersist)
        );

        const shouldPreserveLocalCloneExecution = shouldKeepLocalCloneExecution(
          prev.cloneExecution,
          incomingState.cloneExecution
        );

        const nextState: SessionState = shouldPreserveLocalCloneExecution
          ? {
              ...incomingState,
              videoModel: 'kling_3',
              cloneExecution: prev.cloneExecution
            }
          : {
              ...incomingState,
              videoModel: 'kling_3',
              cloneExecution: mergeCloneExecutionWithLocal(prev.cloneExecution, incomingState.cloneExecution) ?? incomingState.cloneExecution
            };

        if (nextState.motionClone) {
          nextState.motionClone = buildNextMotionCloneState(nextState.motionClone, {});
        }

        nextState.avatarSelection = syncAvatarSelectionFromSession(nextState);
        nextState.avatarStage = inferProjectAgentAvatarStage({
          explicitStage: nextState.avatarStage,
          hasAvatar: Boolean(nextState.avatarSelection.avatar?.id),
          hasDraft: Boolean(nextState.avatarDraft?.scenes?.length),
          hasCover: Boolean(nextState.avatarDraft?.coverImageUrl || nextState.generatedImageUrl),
          projectStatus: nextState.step,
          currentStep: nextState.step,
          hasExecution: Boolean(nextState.avatarExecution?.projectId || nextState.projectId)
        });

        if (!shouldPreserveLocalCloneDraft) {
          if (shouldPreserveLocalCloneSelections && nextState.cloneReplacementDraft) {
            return {
              ...nextState,
              cloneReplacementDraft: {
                ...nextState.cloneReplacementDraft,
                selectedAvatars: localDraft?.selectedAvatars,
                selectedAvatar: localDraft?.selectedAvatar,
                selectedProducts: localDraft?.selectedProducts,
                selectedProduct: localDraft?.selectedProduct
              }
            };
          }
          return nextState;
        }

        return {
          ...nextState,
          cloneReplacementDraft: localDraft
        };
      });

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
    if (!sessionId || !isSessionReady) return;
    void fetchSession();
    void refreshHistory();
  }, [sessionId, isSessionReady, fetchSession, refreshHistory]);

  useEffect(() => {
    if (!error) return;
    setStatusNote(error.message || 'Flowgen hit an error. Please retry.');
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
    prevAvatarPhaseRef.current = null;
    prevClonePhaseRef.current = null;
    notificationPermissionRequestedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    const nextPhase = sessionState?.avatarExecution?.phase ?? null;
    if (!nextPhase) return;

    const previousPhase = prevAvatarPhaseRef.current;
    if (previousPhase === nextPhase) return;

    if (nextPhase === 'generating_cover') {
      sendBrowserNotification({
        title: 'Image generation started',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-image-start'
      });
    } else if (nextPhase === 'generating_videos') {
      sendBrowserNotification({
        title: 'Video generation started',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-video-start'
      });
    } else if (nextPhase === 'completed') {
      sendBrowserNotification({
        title: 'Your video is ready',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-completed'
      });
    } else if (nextPhase === 'failed') {
      sendBrowserNotification({
        title: 'Generation failed',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-failed'
      });
    }

    prevAvatarPhaseRef.current = nextPhase;
  }, [sessionState?.avatarExecution?.phase]);

  useEffect(() => {
    const nextPhase = sessionState?.cloneExecution?.phase ?? null;
    if (!nextPhase) return;

    const previousPhase = prevClonePhaseRef.current;
    if (!shouldNotifyClonePhaseTransition(previousPhase ?? undefined, nextPhase)) {
      prevClonePhaseRef.current = nextPhase;
      return;
    }

    if (nextPhase === 'generating_frames') {
      sendBrowserNotification({
        title: 'Image generation started',
        body: 'Flowgen: Clone Workflow',
        tag: 'agent-clone-frames-start'
      });
    } else if (nextPhase === 'generating_videos') {
      sendBrowserNotification({
        title: 'Video generation started',
        body: 'Flowgen: Clone Workflow',
        tag: 'agent-clone-videos-start'
      });
    } else if (nextPhase === 'merging') {
      sendBrowserNotification({
        title: 'Video generation started',
        body: 'Flowgen: Clone Workflow',
        tag: 'agent-clone-merging'
      });
    } else if (nextPhase === 'completed') {
      sendBrowserNotification({
        title: 'Your video is ready',
        body: 'Flowgen: Clone Workflow',
        tag: 'agent-clone-completed'
      });
    } else if (nextPhase === 'failed') {
      sendBrowserNotification({
        title: 'Generation failed',
        body: 'Flowgen: Clone Workflow',
        tag: 'agent-clone-failed'
      });
    }

    prevClonePhaseRef.current = nextPhase;
  }, [sessionState?.cloneExecution?.phase]);

  useEffect(() => {
    if (!sessionId) return;
    if (status !== 'ready') return;
    if (isStreaming) return;
    void fetchSession();
  }, [fetchSession, isStreaming, sessionId, status]);

  useEffect(() => {
    if (!sessionId || !isStreaming) return;
    const inCloneFlow = sessionState?.intent === 'competitor_ugc_replication' && Boolean(sessionState?.cloneReferenceVideo?.id);
    if (!inCloneFlow) return;

    const timer = window.setInterval(() => {
      void fetchSession();
    }, 900);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchSession, isStreaming, sessionId, sessionState?.cloneReferenceVideo?.id, sessionState?.intent]);

  useEffect(() => {
    if (sessionState?.intent !== 'avatar_ads') return;
    const projectId = sessionState?.projectId;
    if (!projectId) return;

    const abortController = new AbortController();

    type AvatarStatusPayload = {
      project: AvatarProjectLike;
      scenes: AvatarSceneLike[];
    };

    const fetchAvatarProjectStatus = async (
      attempt = 1,
      maxAttempts = 3
    ): Promise<AvatarStatusPayload | null> => {
      try {
        const response = await fetch(`/api/avatar-ads/${projectId}/status`, {
          cache: 'no-store',
          signal: abortController.signal
        });

        if (!response.ok) {
          if (response.status === 404 && attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
            return fetchAvatarProjectStatus(attempt + 1, maxAttempts);
          }
          return null;
        }

        const payload = await response.json() as AvatarStatusPayload;
        if (!payload?.project?.id) {
          return null;
        }
        return payload;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          return null;
        }
        console.error('Failed to fetch avatar project status:', error);
        return null;
      }
    };

    const syncAvatarProjectStatus = async () => {
      try {
        const payload = await fetchAvatarProjectStatus();
        if (!payload?.project) return;

        const latestState = latestSessionStateRef.current;
        if (latestState?.intent !== 'avatar_ads') return;

        const nextSelection = syncAvatarSelectionFromSession(latestState);
        const nextDraft = buildProjectAgentAvatarDraft(payload.project, payload.scenes, {
          avatarName: nextSelection.avatar?.name ?? null,
          productName: nextSelection.product?.name ?? null
        });
        const nextExecution = buildProjectAgentAvatarExecution(payload.project, payload.scenes);
        const nextStage = inferProjectAgentAvatarStage({
          explicitStage: latestState?.avatarStage,
          hasAvatar: Boolean(nextSelection.avatar?.id),
          hasDraft: Boolean(nextDraft?.scenes.length),
          hasCover: Boolean(nextDraft?.coverImageUrl || payload.project.generated_image_url),
          projectStatus: payload.project.status,
          currentStep: payload.project.current_step,
          hasExecution: Boolean(nextExecution?.projectId)
        });
        const nextStep = payload.project.status ?? latestState?.step;
        const nextImagePrompt = nextDraft?.imagePrompt ?? payload.project.image_prompt ?? latestState?.imagePrompt ?? null;
        const nextGeneratedImageUrl = payload.project.generated_image_url ?? latestState?.generatedImageUrl ?? null;

        const hasStatusChange = (
          latestState?.step !== nextStep ||
          latestState?.generatedPrompts !== (payload.project.generated_prompts ?? null) ||
          latestState?.imagePrompt !== nextImagePrompt ||
          latestState?.generatedImageUrl !== nextGeneratedImageUrl ||
          latestState?.avatarStage !== nextStage ||
          latestState?.avatarDraft?.coverImageUrl !== (nextDraft?.coverImageUrl ?? null) ||
          latestState?.avatarExecution?.phase !== (nextExecution?.phase ?? null) ||
          latestState?.avatarExecution?.finalVideoUrl !== (nextExecution?.finalVideoUrl ?? null) ||
          latestState?.avatarExecution?.coverImageUrl !== (nextExecution?.coverImageUrl ?? null) ||
          latestState?.avatarExecution?.error !== (nextExecution?.error ?? null)
        );

        if (!hasStatusChange) return;

        setSessionState((prev) => {
          if (!prev) return prev;
          const nextState = {
            ...prev,
            step: nextStep,
            generatedPrompts: payload.project.generated_prompts ?? prev.generatedPrompts ?? null,
            imagePrompt: nextImagePrompt,
            generatedImageUrl: nextGeneratedImageUrl,
            avatarDraft: nextDraft,
            avatarExecution: nextExecution,
            avatarStage: nextStage
          };
          latestSessionStateRef.current = nextState;
          return nextState;
        });

        await fetch('/api/project-agent/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            statePatch: {
              step: nextStep,
              generatedPrompts: payload.project.generated_prompts ?? null,
              imagePrompt: nextImagePrompt,
              generatedImageUrl: nextGeneratedImageUrl,
              avatarDraft: nextDraft,
              avatarExecution: nextExecution,
              avatarStage: nextStage
            },
            projectId
          })
        });
      } catch (syncError) {
        console.error('Failed to sync avatar project status:', syncError);
      }
    };

    const channel: RealtimeChannel = supabase
      .channel(`project-agent-avatar-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'avatar_ads_projects',
          filter: `id=eq.${projectId}`
        },
        () => { void syncAvatarProjectStatus(); }
      )
      .subscribe();

    void syncAvatarProjectStatus();

    const shouldPollAvatarStatus = (
      sessionState?.avatarExecution?.phase === 'generating_cover' ||
      sessionState?.avatarExecution?.phase === 'generating_videos' ||
      sessionState?.avatarStage === 'avatar_generating_cover' ||
      sessionState?.avatarStage === 'avatar_generating_video'
    );
    const pollTimer = shouldPollAvatarStatus
      ? window.setInterval(() => {
          void syncAvatarProjectStatus();
        }, 4000)
      : null;

    return () => {
      abortController.abort();
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [sessionId, sessionState?.intent, sessionState?.projectId, sessionState?.avatarExecution?.phase, sessionState?.avatarStage, supabase]);

  useEffect(() => {
    if (sessionState?.intent !== 'motion_clone') return;
    const projectId = sessionState?.motionClone?.projectId;
    if (!projectId) return;

    const syncMotionCloneProjectStatus = async () => {
      try {
        const response = await fetch(`/api/motion-clone/${projectId}/status`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload?.project) return;

        const latestState = latestSessionStateRef.current;
        const currentMotionClone = latestState?.motionClone;
        const nextMotionClone = buildNextMotionCloneState(currentMotionClone, {
          projectId,
          phase: payload.project.status === 'completed'
            ? 'completed'
            : payload.project.status === 'generating_video'
              ? 'generating_video'
              : payload.project.status === 'preview_ready'
                ? 'preview_ready'
                : payload.project.status === 'generating_preview'
                  ? 'generating_preview'
                  : payload.project.status === 'failed'
                    ? 'failed'
                    : 'idle',
          status: payload.project.status ?? null,
          previewImageUrl: payload.project.preview_image_url ?? null,
          outputVideoUrl: payload.project.output_video_url ?? null,
          photoPrompt: payload.project.photo_prompt ?? currentMotionClone?.photoPrompt ?? null,
          videoPrompt: payload.project.video_prompt ?? currentMotionClone?.videoPrompt ?? null,
          videoQuality: normalizeMotionCloneQuality(payload.project.mode),
          durationSeconds: payload.project.reference_duration_seconds ?? null,
          creditsCost: payload.project.credits_cost ?? null,
          error: payload.project.error_message ?? null
        });

        const mergedMotionClone = buildNextMotionCloneState(nextMotionClone, {
          referenceVideo: currentMotionClone?.referenceVideo ?? nextMotionClone.referenceVideo ?? null,
          selectedAvatar: currentMotionClone?.selectedAvatar ?? nextMotionClone.selectedAvatar ?? null,
          selectedProduct: currentMotionClone?.selectedProduct ?? nextMotionClone.selectedProduct ?? null
        });

        const hasStatusChange = (
          currentMotionClone?.phase !== mergedMotionClone.phase ||
          currentMotionClone?.status !== mergedMotionClone.status ||
          currentMotionClone?.previewImageUrl !== mergedMotionClone.previewImageUrl ||
          currentMotionClone?.outputVideoUrl !== mergedMotionClone.outputVideoUrl ||
          currentMotionClone?.error !== mergedMotionClone.error
        );

        if (!hasStatusChange) return;

        setSessionState((prev) => {
          if (!prev) return prev;
          const nextState = {
            ...prev,
            motionClone: mergedMotionClone
          };
          latestSessionStateRef.current = nextState;
          return nextState;
        });

        await fetch('/api/project-agent/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            projectId,
            statePatch: {
              motionClone: mergedMotionClone
            }
          })
        });
      } catch (motionSyncError) {
        console.error('Failed to sync motion clone project status:', motionSyncError);
      }
    };

    const channel: RealtimeChannel = supabase
      .channel(`project-agent-motion-clone-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'motion_clone_projects',
          filter: `id=eq.${projectId}`
        },
        () => { void syncMotionCloneProjectStatus(); }
      )
      .subscribe();

    void syncMotionCloneProjectStatus();

    const shouldPollMotionCloneStatus = (
      sessionState.motionClone?.phase === 'generating_preview' ||
      sessionState.motionClone?.phase === 'generating_video'
    );
    const pollTimer = shouldPollMotionCloneStatus
      ? window.setInterval(() => {
          void syncMotionCloneProjectStatus();
        }, 4000)
      : null;

    return () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [sessionId, sessionState?.intent, sessionState?.motionClone?.phase, sessionState?.motionClone?.projectId, supabase]);

  const handleSubmit = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const next = draft.trim();
    if (!next || !sessionId || sendLocked) return;

    if (pendingCloneSelectionPersistRef.current) {
      await pendingCloneSelectionPersistRef.current;
    }
    if (pendingCloneDraftPersistRef.current) {
      await pendingCloneDraftPersistRef.current;
    }
    const latestDraft = latestCloneDraftRef.current ?? sessionState?.cloneReplacementDraft;
    if (latestDraft) {
      if (draftPersistTimerRef.current) {
        clearTimeout(draftPersistTimerRef.current);
        draftPersistTimerRef.current = null;
      }

      const persistTask = fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statePatch: { cloneReplacementDraft: latestDraft }
        })
      }).then(() => undefined);
      pendingCloneDraftPersistRef.current = persistTask;
      try {
        await persistTask;
      } finally {
        if (pendingCloneDraftPersistRef.current === persistTask) {
          pendingCloneDraftPersistRef.current = null;
        }
      }
    }

    setDraft('');
    clearError();
    setStatusNote('');
    setRetryableUserMessageId(null);
    ensureHistoryTracked(sessionId);
    setPendingUserText(next);
    setPendingBaselineCount(messages.length);
    maybeRequestNotificationPermissionOnUserAction(next);
    const sent = await sendMessageSafely(next);
    if (!sent) {
      setPendingUserText(null);
      setPendingBaselineCount(0);
      const latestUser = [...dedupeConversationMessages(messages)]
        .reverse()
        .find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);
      if (latestUser?.id) {
        setRetryableUserMessageId(latestUser.id);
      }
      return;
    }
  }, [
    clearError,
    draft,
    ensureHistoryTracked,
    messages,
    maybeRequestNotificationPermissionOnUserAction,
    sendMessageSafely,
    sendLocked,
    sessionId,
    sessionState?.cloneReplacementDraft
  ]);

  const retryLastUserMessage = useCallback(async () => {
    if (isStreaming) return false;

    const visibleMessages = dedupeConversationMessages(messages);
    const lastUser = [...visibleMessages]
      .reverse()
      .find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);
    if (!lastUser?.id) return false;

    const retryText = renderUIMessageText(lastUser).trim();
    if (!retryText) return false;

    clearError();
    setStatusNote('');
    setRetryableUserMessageId(null);
    setMessages((prev) => removeTrailingDuplicateUserMessages(prev, retryText));
    setPendingUserText(retryText);
    setPendingBaselineCount(visibleMessages.length);
    maybeRequestNotificationPermissionOnUserAction(retryText);

    const sent = await sendMessageSafely(retryText);
    if (!sent) {
      setPendingUserText(null);
      setPendingBaselineCount(0);
      setRetryableUserMessageId(lastUser.id);
      return false;
    }

    return true;
  }, [clearError, isStreaming, messages, maybeRequestNotificationPermissionOnUserAction, sendMessageSafely, setMessages]);

  const handleRetryLatestUserMessage = useCallback(() => {
    void retryLastUserMessage();
  }, [retryLastUserMessage]);

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
            return {
              id: product.id as string,
              name: (typeof product.product_name === 'string' && product.product_name) || 'Unnamed Product',
              photoUrl: (firstPhoto?.photo_url as string | undefined) ?? null
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
    if (!sessionId || sendLocked) return;

    const referenceName = video.source_name || video.description || `Video ${video.id.slice(0, 8)}`;
    const referenceSelectionMessage = `I selected "${referenceName}" as the reference video for clone.`;
    const pendingBaseline = messages.length;
    const structure = inferMotionCloneReferenceContext(video.analysis_result);
    const referencePatch = {
      intent: 'competitor_ugc_replication' as const,
      step: 'collecting',
      videoModel: 'kling_3' as const,
      avatar: null,
      product: null,
      cloneReferenceVideo: {
        id: video.id,
        sourceType: video.source_type || 'creator',
        sourceId: (video.source_type === 'competitor_ad')
          ? (video.source_id || video.id)
          : video.id,
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

    setPendingUserText(referenceSelectionMessage);
    setPendingBaselineCount(pendingBaseline);
    setSessionState((prev) => ({
      ...(prev ?? {}),
      ...referencePatch
    }));
    setShowCloneableVideos(false);
    setAwaitingCloneEntryReply(false);
    setCloneEntryReplyBaseline(0);
    setHandledCloneIntentUserMessageId(null);
    setShowCloneReplacementSelectors(false);
    setSelectedCloneAvatarIds([]);
    setSelectedCloneProductIds([]);
    setAwaitingCloneDraftReply(false);
    setCloneDraftReplyBaseline(0);
    setAwaitingCloneStructureReply(true);
    setCloneStructureReplyReady(false);
    setCloneStructureReplyBaseline(dedupeConversationMessages(messages).length);
    try {
      const response = await fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statePatch: referencePatch
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to save selected reference video.');
      }
    } catch (patchError) {
      console.error('Failed to persist selected clone reference:', patchError);
      setStatusNote('Failed to save selected reference video. Please retry.');
      setPendingUserText(null);
      setPendingBaselineCount(0);
      return;
    }
    try {
      clearError();
      setStatusNote('');
      ensureHistoryTracked(sessionId);
      const sent = await sendMessageSafely(referenceSelectionMessage);
      if (!sent) {
        setPendingUserText(null);
        setPendingBaselineCount(0);
        setAwaitingCloneStructureReply(false);
        setCloneStructureReplyReady(false);
        setCloneStructureReplyBaseline(0);
        const latestUser = [...dedupeConversationMessages(messages)]
          .reverse()
          .find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);
        if (latestUser?.id) {
          setRetryableUserMessageId(latestUser.id);
        }
      }
    } catch (chatSendError) {
      // Keep clone flow progressing even if chat transport has an intermittent failure.
      console.error('Failed to send reference selection message to chat stream:', chatSendError);
      setPendingUserText(null);
      setPendingBaselineCount(0);
      setAwaitingCloneStructureReply(false);
      setCloneStructureReplyReady(false);
      setCloneStructureReplyBaseline(0);
      const latestUser = [...dedupeConversationMessages(messages)]
        .reverse()
        .find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);
      if (latestUser?.id) {
        setRetryableUserMessageId(latestUser.id);
      }
    }

    void loadCloneReplacementOptions();

  }, [clearError, ensureHistoryTracked, loadCloneReplacementOptions, messages, sendLocked, sendMessageSafely, sessionId]);

  const startNewChat = useCallback(() => {
    const nextId = createSessionId();
    setIsSessionReady(false);
    setSessionId(nextId);
    setSessionState(null);
    setDraft('');
    setPendingUserText(null);
    setStatusNote('');
    setMessages([]);
    setShowCloneableVideos(false);
    setAwaitingCloneEntryReply(false);
    setCloneEntryReplyBaseline(0);
    setHandledCloneIntentUserMessageId(null);
    setShowCloneReplacementSelectors(false);
    setAwaitingCloneStructureReply(false);
    setCloneStructureReplyReady(false);
    setAwaitingCloneDraftReply(false);
    setSelectedCloneAvatarIds([]);
    setSelectedCloneProductIds([]);
    setRetryableUserMessageId(null);
    setIsGeneratingCloneProject(false);
    setIsHistoryPopoverOpen(false);

    writeCurrentSessionId(nextId);
    ensureHistoryTracked(nextId, { prependIfNew: true });
    void ensureSessionExists(nextId).finally(() => {
      setIsSessionReady(true);
    });
    void refreshHistory();
  }, [ensureHistoryTracked, ensureSessionExists, refreshHistory, setMessages]);

  const selectHistory = useCallback((targetSessionId: string) => {
    setIsSessionReady(false);
    setSessionId(targetSessionId);
    setSessionState(null);
    setPendingUserText(null);
    setStatusNote('');
    setMessages([]);
    setShowCloneableVideos(false);
    setHandledCloneIntentUserMessageId(null);
    setShowCloneReplacementSelectors(false);
    setAwaitingCloneStructureReply(false);
    setCloneStructureReplyReady(false);
    setAwaitingCloneDraftReply(false);
    setSelectedCloneAvatarIds([]);
    setSelectedCloneProductIds([]);
    setRetryableUserMessageId(null);
    setIsGeneratingCloneProject(false);
    setIsHistoryPopoverOpen(false);

    writeCurrentSessionId(targetSessionId);
    ensureHistoryTracked(targetSessionId);
  }, [ensureHistoryTracked, setMessages]);

  const isReady = Boolean(sessionId);
  const handlePromptChipClick = useCallback((value: string) => {
    if (
      !isReady ||
      Boolean(pendingUserText) ||
      isStreaming ||
      awaitingCloneEntryReply ||
      awaitingCloneStructureReply ||
      awaitingCloneDraftReply ||
      isGeneratingCloneProject
    ) {
      return;
    }
    setDraft(value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(value.length, value.length);
    });
  }, [
    awaitingCloneDraftReply,
    awaitingCloneEntryReply,
    awaitingCloneStructureReply,
    isGeneratingCloneProject,
    isReady,
    isStreaming,
    pendingUserText
  ]);
  const displayMessages = useMemo(() => dedupeConversationMessages(messages), [messages]);
  const persistVisibleMessages = useCallback(async (sourceMessages: UIMessage[]) => {
    if (!sessionId) return;

    const payloadMessages = sourceMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts
    }));

    try {
      await fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages: payloadMessages
        })
      });
    } catch (persistError) {
      console.error('Failed to persist visible messages:', persistError);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (isStreaming || status !== 'ready') return;
    if (displayMessages.length === 0) return;

    const hasAssistant = displayMessages.some((message) => (
      message.role === 'assistant' && renderUIMessageText(message).trim().length > 0
    ));
    if (!hasAssistant) return;

    const signature = JSON.stringify(
      displayMessages.map((message) => [message.id, message.role, renderUIMessageText(message).trim()])
    );
    if (signature === lastPersistedMessagesSignatureRef.current) return;

    lastPersistedMessagesSignatureRef.current = signature;
    void persistVisibleMessages(displayMessages);
  }, [displayMessages, isStreaming, persistVisibleMessages, sessionId, status]);

  const filteredHistoryItems = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return historyItems;
    return historyItems.filter((item) => item.title.toLowerCase().includes(query));
  }, [historyItems, historyQuery]);

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

  const loadMotionCloneAssets = useCallback(async () => {
    setIsMotionCloneAssetsLoading(true);
    try {
      const [assetsResponse, avatarsResponse] = await Promise.all([
        fetch('/api/assets', { cache: 'no-store' }),
        fetch('/api/user-avatars', { cache: 'no-store' })
      ]);

      if (assetsResponse.ok) {
        const payload = await assetsResponse.json();
        const videos = Array.isArray(payload?.videos) ? payload.videos : [];
        const products = Array.isArray(payload?.products) ? payload.products : [];
        const normalizedVideos = videos
          .filter((video: Record<string, unknown>) => (
            typeof video.id === 'string' && video.source_type !== 'competitor_ad'
          ))
          .map((video: Record<string, unknown>) => ({
            ...(inferMotionCloneReferenceContext(
              (video.analysis_result && typeof video.analysis_result === 'object')
                ? (video.analysis_result as Record<string, unknown>)
                : null
            )),
            id: video.id as string,
            description: typeof video.description === 'string' ? video.description : null,
            videoUrl: typeof video.video_url === 'string' ? video.video_url : null,
            videoCdnUrl: typeof video.video_cdn_url === 'string' ? video.video_cdn_url : null,
            coverUrl: typeof video.cover_url === 'string' ? video.cover_url : null,
            durationSeconds: typeof video.duration_seconds === 'number' ? video.duration_seconds : null,
            analysisLanguage: typeof video.analysis_language === 'string' ? video.analysis_language : null,
            analysisStatus: typeof video.analysis_status === 'string' ? video.analysis_status : null,
            analysisResult: (video.analysis_result && typeof video.analysis_result === 'object')
              ? (video.analysis_result as Record<string, unknown>)
              : null,
            analysisError: typeof video.analysis_error === 'string' ? video.analysis_error : null,
            platform: typeof video.platform === 'string' ? video.platform : undefined,
            source_id: typeof video.source_id === 'string' ? video.source_id : null,
            source_name: typeof video.source_name === 'string' ? video.source_name : null,
            source_type: video.source_type === 'competitor_ad' ? 'competitor_ad' : 'creator',
            stats: (video.stats && typeof video.stats === 'object')
              ? (video.stats as Record<string, unknown>)
              : null
          })) as MotionReferenceVideoAsset[];
        setMotionCloneVideos(normalizedVideos);
        setMotionCloneProducts(products as UserProduct[]);
      }

      if (avatarsResponse.ok) {
        const payload = await avatarsResponse.json();
        setMotionCloneAvatars((Array.isArray(payload?.avatars) ? payload.avatars : []) as UserAvatar[]);
      }
    } catch (motionAssetError) {
      console.error('Failed to load motion clone assets:', motionAssetError);
    } finally {
      setIsMotionCloneAssetsLoading(false);
    }
  }, []);

  const handleQuickStart = useCallback(async (action: 'clone' | 'motion_clone' | 'avatar_ads') => {
    if (!sessionId || sendLocked) return;

    clearError();
    setStatusNote('');
    ensureHistoryTracked(sessionId);

    if (action === 'motion_clone') {
      setSessionState((prev) => ({
        ...(prev ?? {}),
        intent: 'motion_clone',
        motionClone: buildNextMotionCloneState(prev?.motionClone, {
          stage: 'reference_selection',
          phase: 'idle',
          selectedAvatar: null,
          selectedProduct: null,
          photoPrompt: null,
          videoPrompt: null,
          promptsInitialized: false
        })
      }));
      void loadMotionCloneAssets();
      const quickMessage = 'I want to use motion clone. Help me choose a reference video and replacement avatar or product.';
      setPendingUserText(quickMessage);
      setPendingBaselineCount(messages.length);
      const sent = await sendMessageSafely(quickMessage);
      if (!sent) {
        setPendingUserText(null);
        setPendingBaselineCount(0);
      }
      return;
    }

    if (action === 'avatar_ads') {
      setSessionState((prev) => ({
        ...(prev ?? {}),
        intent: 'avatar_ads',
        avatarStage: 'avatar_asset_selection',
        avatarSelection: syncAvatarSelectionFromSession(prev),
        avatarDraft: prev?.intent === 'avatar_ads' ? prev?.avatarDraft ?? null : null,
        avatarExecution: prev?.intent === 'avatar_ads' ? prev?.avatarExecution ?? null : null,
        projectId: prev?.intent === 'avatar_ads' ? prev?.projectId : undefined
      }));
      const quickMessage = 'I want to create an avatar ad. Help me choose the avatar first, then the optional product, script, and settings.';
      setPendingUserText(quickMessage);
      setPendingBaselineCount(messages.length);
      const sent = await sendMessageSafely(quickMessage);
      if (!sent) {
        setPendingUserText(null);
        setPendingBaselineCount(0);
      }
      return;
    }

    // Enter clone flow with a strict gate: keep left surface in "Working on it..."
    // until we receive a visible assistant reply for this turn.
    setShowCloneableVideos(false);
    setAwaitingCloneEntryReply(true);
    setCloneEntryReplyBaseline(dedupeConversationMessages(messages).length);
    setHandledCloneIntentUserMessageId(null);
    setShowCloneReplacementSelectors(false);
    setAwaitingCloneStructureReply(false);
    setAwaitingCloneDraftReply(false);

    const quickCloneMessage = 'I want to clone a viral video. Show me reference videos to choose from.';
    setPendingUserText(quickCloneMessage);
    setPendingBaselineCount(messages.length);
    const sent = await sendMessageSafely(quickCloneMessage);
    if (!sent) {
      setPendingUserText(null);
      setPendingBaselineCount(0);
      const latestUser = [...dedupeConversationMessages(messages)]
        .reverse()
        .find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);
      if (latestUser?.id) {
        setRetryableUserMessageId(latestUser.id);
      }
    }
    void loadCloneableVideos();
  }, [
    clearError,
    ensureHistoryTracked,
    loadCloneableVideos,
    loadMotionCloneAssets,
    messages,
    sendLocked,
    sendMessageSafely,
    sessionId
  ]);

  const persistCloneSelection = useCallback(async (
    next: {
      selectedAvatars?: CloneAvatarSelection[] | null;
      selectedProducts?: CloneProductSelection[] | null;
    }
  ) => {
    if (!sessionId) return;
    const nextSelectedAvatars = next.selectedAvatars !== undefined
      ? normalizeCloneSelections(next.selectedAvatars)
      : normalizeCloneSelections(
          sessionState?.cloneReplacementDraft?.selectedAvatars,
          sessionState?.cloneReplacementDraft?.selectedAvatar
        );
    const nextSelectedProducts = next.selectedProducts !== undefined
      ? normalizeCloneSelections(next.selectedProducts)
      : normalizeCloneSelections(
          sessionState?.cloneReplacementDraft?.selectedProducts,
          sessionState?.cloneReplacementDraft?.selectedProduct
        );
    const primaryAvatar = getPrimaryCloneSelection(nextSelectedAvatars);
    const primaryProduct = getPrimaryCloneSelection(nextSelectedProducts);
    const statePatch: Record<string, unknown> = {
      cloneReplacementDraft: {
        ...(sessionState?.cloneReplacementDraft ?? {
          status: 'idle',
          error: null,
          scenes: []
        }),
        ...(next.selectedAvatars !== undefined
          ? {
              selectedAvatars: nextSelectedAvatars,
              selectedAvatar: primaryAvatar
            }
          : {}),
        ...(next.selectedProducts !== undefined
          ? {
              selectedProducts: nextSelectedProducts,
              selectedProduct: primaryProduct
            }
          : {})
      }
    };
    if (next.selectedAvatars !== undefined) {
      statePatch.avatar = primaryAvatar
        ? {
            id: primaryAvatar.id,
            name: primaryAvatar.name,
            photoUrl: primaryAvatar.photoUrl || ''
          }
        : null;
    }
    if (next.selectedProducts !== undefined) {
      statePatch.product = primaryProduct
        ? {
            id: primaryProduct.id,
            name: primaryProduct.name
          }
        : null;
    }

    const persistTask = (async () => {
      try {
        const response = await fetch('/api/project-agent/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, statePatch })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to persist clone selection.');
        }
      } catch (selectionPersistError) {
        console.error('Failed to persist clone selection:', selectionPersistError);
        setStatusNote('Failed to sync selected avatar/product. Please click again.');
      }
    })();

    pendingCloneSelectionPersistRef.current = persistTask;
    await persistTask;
    if (pendingCloneSelectionPersistRef.current === persistTask) {
      pendingCloneSelectionPersistRef.current = null;
    }
  }, [sessionId, sessionState?.cloneReplacementDraft, setStatusNote]);

  const handleManualAvatarSelection = useCallback((avatarId: string) => {
    const selected = cloneAvatarOptions.find((avatar) => avatar.id === avatarId);
    if (!selected) return;
    const latestDraft = latestCloneDraftRef.current ?? sessionState?.cloneReplacementDraft;
    const explicitSelectedAvatars = normalizeCloneSelections(
      latestDraft?.selectedAvatars,
      latestDraft?.selectedAvatar
    );
    const explicitSelectedAvatarIds = explicitSelectedAvatars.map((avatar) => avatar.id);
    const isSelected = explicitSelectedAvatarIds.includes(avatarId);
    if (!isSelected && explicitSelectedAvatarIds.length >= MAX_CLONE_MULTI_SELECT) {
      setStatusNote(`You can select up to ${MAX_CLONE_MULTI_SELECT} avatars for one clone.`);
      return;
    }
    setStatusNote('');
    const nextAvatarIds = isSelected
      ? explicitSelectedAvatarIds.filter((id) => id !== avatarId)
      : [...explicitSelectedAvatarIds, avatarId];
    const nextSelectedAvatars = nextAvatarIds
      .map((id) => cloneAvatarOptions.find((avatar) => avatar.id === id))
      .filter((avatar): avatar is CloneAvatarOption => Boolean(avatar))
      .map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        photoUrl: avatar.photoUrl || null
      }));
    const primaryAvatar = nextSelectedAvatars[0] ?? null;
    lastLocalCloneDraftEditAtRef.current = Date.now();
    setSelectedCloneAvatarIds(nextAvatarIds);
    setSessionState((prev) => (
      prev
        ? (() => {
            const nextState = {
              ...prev,
              avatar: primaryAvatar
                ? {
                    id: primaryAvatar.id,
                    name: primaryAvatar.name,
                    photoUrl: primaryAvatar.photoUrl || ''
                  }
                : null,
              cloneReplacementDraft: {
                ...(prev.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                selectedAvatars: nextSelectedAvatars,
                selectedAvatar: primaryAvatar
              }
            };
            latestSessionStateRef.current = nextState;
            latestCloneDraftRef.current = nextState.cloneReplacementDraft ?? null;
            return nextState;
          })()
        : prev
    ));
    void persistCloneSelection({
      selectedAvatars: nextSelectedAvatars
    });
  }, [cloneAvatarOptions, persistCloneSelection, sessionState?.cloneReplacementDraft, setStatusNote]);

  const handleManualProductSelection = useCallback((productId: string) => {
    const selected = cloneProductOptions.find((product) => product.id === productId);
    if (!selected) return;
    const latestDraft = latestCloneDraftRef.current ?? sessionState?.cloneReplacementDraft;
    const explicitSelectedProducts = normalizeCloneSelections(
      latestDraft?.selectedProducts,
      latestDraft?.selectedProduct
    );
    const explicitSelectedProductIds = explicitSelectedProducts.map((product) => product.id);
    const isSelected = explicitSelectedProductIds.includes(productId);
    if (!isSelected && explicitSelectedProductIds.length >= MAX_CLONE_MULTI_SELECT) {
      setStatusNote(`You can select up to ${MAX_CLONE_MULTI_SELECT} products for one clone.`);
      return;
    }
    setStatusNote('');
    const nextProductIds = isSelected
      ? explicitSelectedProductIds.filter((id) => id !== productId)
      : [...explicitSelectedProductIds, productId];
    const nextSelectedProducts = nextProductIds
      .map((id) => cloneProductOptions.find((product) => product.id === id))
      .filter((product): product is CloneProductOption => Boolean(product))
      .map((product) => ({
        id: product.id,
        name: product.name,
        photoUrl: product.photoUrl || null
      }));
    const primaryProduct = nextSelectedProducts[0] ?? null;
    lastLocalCloneDraftEditAtRef.current = Date.now();
    setSelectedCloneProductIds(nextProductIds);
    setSessionState((prev) => (
      prev
        ? (() => {
            const nextState = {
              ...prev,
              product: primaryProduct
                ? {
                    id: primaryProduct.id,
                    name: primaryProduct.name
                  }
                : null,
              cloneReplacementDraft: {
                ...(prev.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                selectedProducts: nextSelectedProducts,
                selectedProduct: primaryProduct
              }
            };
            latestSessionStateRef.current = nextState;
            latestCloneDraftRef.current = nextState.cloneReplacementDraft ?? null;
            return nextState;
          })()
        : prev
    ));
    void persistCloneSelection({
      selectedProducts: nextSelectedProducts
    });
  }, [cloneProductOptions, persistCloneSelection, sessionState?.cloneReplacementDraft, setStatusNote]);

  const handleAvatarAssetSelectionMessage = useCallback(async (text: string) => {
    if (!sessionId || sendLocked) return;
    clearError();
    setStatusNote('');
    maybeRequestNotificationPermissionOnUserAction(text);
    const sent = await sendMessageSafely(text);
    if (!sent) {
      setStatusNote('Failed to send the avatar selection. Please try again.');
    }
  }, [clearError, maybeRequestNotificationPermissionOnUserAction, sendLocked, sendMessageSafely, sessionId]);

  const persistAvatarSelectionPatch = useCallback(async (statePatch: Record<string, unknown>) => {
    if (!sessionId) return;
    await fetch('/api/project-agent/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        statePatch
      })
    });
  }, [sessionId]);

  const handleAvatarSelectionToggle = useCallback(async (avatarId: string) => {
    const avatar = cloneAvatarOptions.find((item) => item.id === avatarId);
    if (!avatar) return;

    const baseState = latestSessionStateRef.current ?? sessionState;
    if (!baseState) return;

    const currentSelection = syncAvatarSelectionFromSession(baseState);
    const isSame = currentSelection.avatar?.id === avatarId;
    const nextAvatar = isSame
      ? null
      : {
          id: avatar.id,
          name: avatar.name,
          photoUrl: avatar.photoUrl || ''
        };
    const nextSelection = {
      ...currentSelection,
      avatar: nextAvatar
    };
    const nextState = {
      ...baseState,
      avatar: nextAvatar,
      product: nextSelection.product
        ? {
            id: nextSelection.product.id,
            name: nextSelection.product.name
          }
        : null,
      avatarSelection: nextSelection,
      avatarStage: 'avatar_asset_selection' as const
    };

    latestSessionStateRef.current = nextState;
    setSessionState(nextState);

    await persistAvatarSelectionPatch({
      avatar: nextState.avatar,
      product: nextState.product ?? null,
      avatarSelection: nextSelection,
      avatarStage: 'avatar_asset_selection'
    });
  }, [cloneAvatarOptions, persistAvatarSelectionPatch, sessionState]);

  const handleAvatarProductSelectionToggle = useCallback(async (productId: string) => {
    const product = cloneProductOptions.find((item) => item.id === productId);
    if (!product) return;

    const baseState = latestSessionStateRef.current ?? sessionState;
    if (!baseState) return;

    const currentSelection = syncAvatarSelectionFromSession(baseState);
    const isSame = currentSelection.product?.id === productId;
    const nextProduct = isSame
      ? null
      : {
          id: product.id,
          name: product.name,
          photoUrl: product.photoUrl || null
        };
    const nextSelection = {
      ...currentSelection,
      product: nextProduct
    };
    const nextState = {
      ...baseState,
      avatar: nextSelection.avatar ?? null,
      product: nextProduct ? {
        id: nextProduct.id,
        name: nextProduct.name
      } : null,
      avatarSelection: nextSelection,
      avatarStage: 'avatar_asset_selection' as const
    };

    latestSessionStateRef.current = nextState;
    setSessionState(nextState);

    await persistAvatarSelectionPatch({
      avatar: nextState.avatar ?? null,
      product: nextState.product ?? null,
      avatarSelection: nextSelection,
      avatarStage: 'avatar_asset_selection'
    });
  }, [cloneProductOptions, persistAvatarSelectionPatch, sessionState]);

  const latestUserText = useMemo(() => {
    const lastUser = [...displayMessages].reverse().find((message) => message.role === 'user');
    return lastUser ? renderUIMessageText(lastUser).trim().toLowerCase() : '';
  }, [displayMessages]);
  const latestUserMessageId = useMemo(() => {
    const lastUser = [...displayMessages].reverse().find((message) => message.role === 'user');
    return lastUser?.id ?? null;
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

  const activeChatTitle = useMemo(() => {
    const firstUser = displayMessages.find((message) => message.role === 'user');
    if (!firstUser) return 'New chat';
    const text = renderUIMessageText(firstUser).trim();
    if (!text) return 'New chat';
    return text.length > 44 ? `${text.slice(0, 44)}...` : text;
  }, [displayMessages]);
  const hasAssistantReplyAfterLatestCloneIntent = useMemo(() => {
    const cloneIntentIndex = findLatestCloneIntentIndex(displayMessages);
    if (cloneIntentIndex < 0) return false;
    return displayMessages
      .slice(cloneIntentIndex + 1)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
  }, [displayMessages]);
  const preferredRegeneratingSceneIndex = useMemo(() => {
    const latestRegenerateCommand = [...displayMessages]
      .reverse()
      .find((message) => (
        message.role === 'user' &&
        extractRegenerateSceneIndex(renderUIMessageText(message)) !== null
      ));
    if (!latestRegenerateCommand) return null;
    return extractRegenerateSceneIndex(renderUIMessageText(latestRegenerateCommand));
  }, [displayMessages]);

  const requestAssistantRetry = useCallback(() => {
    const lastUser = [...displayMessages]
      .reverse()
      .find((message) => message.role === 'user' && renderUIMessageText(message).trim().length > 0);

    if (!lastUser?.id) return false;
    setRetryableUserMessageId(lastUser.id);
    setStatusNote('');
    return false;
  }, [displayMessages]);

  useEffect(() => {
    if (!isCloneIntentTurn) return;
    if (!latestUserMessageId) return;
    if (latestUserMessageId === handledCloneIntentUserMessageId) return;
    if (awaitingCloneEntryReply) return;
    if (sessionState?.intent === 'competitor_ugc_replication' && sessionState?.cloneReferenceVideo?.id) return;

    // Always hide left-step content first for a fresh clone-intent turn.
    // This prevents Step 1 from flashing before assistant text appears.
    setShowCloneableVideos(false);

    // If this exact clone-intent turn already has an assistant reply (e.g. restored history), show Step 1.
    if (hasAssistantReplyAfterLatestCloneIntent && !isStreaming && status === 'ready') {
      void loadCloneableVideos();
      setHandledCloneIntentUserMessageId(latestUserMessageId);
      setShowCloneableVideos(true);
      setAwaitingCloneEntryReply(false);
      setCloneEntryReplyBaseline(0);
      return;
    }

    // Fresh turn: wait for assistant reply before showing Step 1.
    void loadCloneableVideos();
    setHandledCloneIntentUserMessageId(latestUserMessageId);
    setAwaitingCloneEntryReply(true);
    setCloneEntryReplyBaseline(displayMessages.length);
  }, [
    awaitingCloneEntryReply,
    displayMessages.length,
    hasAssistantReplyAfterLatestCloneIntent,
    handledCloneIntentUserMessageId,
    isStreaming,
    isCloneIntentTurn,
    latestUserMessageId,
    loadCloneableVideos,
    sessionState?.cloneReferenceVideo?.id,
    sessionState?.intent,
    status
  ]);

  useEffect(() => {
    if (!awaitingCloneEntryReply) return;

    const hasAssistantReply = displayMessages
      .slice(cloneEntryReplyBaseline)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);

    if (hasAssistantReply) {
      setShowCloneableVideos(true);
      setAwaitingCloneEntryReply(false);
      return;
    }

    if (status === 'ready' && !isStreaming) {
      // If request ended without visible assistant text, stop waiting to avoid infinite spinner.
      setAwaitingCloneEntryReply(false);
      requestAssistantRetry();
    }
  }, [
    awaitingCloneEntryReply,
    cloneEntryReplyBaseline,
    displayMessages,
    isStreaming,
    requestAssistantRetry,
    status
  ]);

  useEffect(() => {
    const hasReference = Boolean(
      sessionState?.intent === 'competitor_ugc_replication' && sessionState?.cloneReferenceVideo?.id
    );

    if (!hasReference) {
      setShowCloneReplacementSelectors(false);
      setAwaitingCloneStructureReply(false);
      setCloneStructureReplyReady(false);
      return;
    }

    setShowCloneableVideos(false);
    // Keep Step 2 hidden while transitioning from confirm -> draft generation,
    // so the surface does not briefly flash back to replacement selectors.
    if (awaitingCloneDraftReply) {
      setShowCloneReplacementSelectors(false);
      return;
    }

    if (!awaitingCloneStructureReply) {
      const draftStatus = sessionState?.cloneReplacementDraft?.status;
      const selectedAvatars = normalizeCloneSelections(
        sessionState?.cloneReplacementDraft?.selectedAvatars,
        sessionState?.cloneReplacementDraft?.selectedAvatar
      );
      const selectedProducts = normalizeCloneSelections(
        sessionState?.cloneReplacementDraft?.selectedProducts,
        sessionState?.cloneReplacementDraft?.selectedProduct
      );
      const hasExistingReplacementSelection = Boolean(
        selectedAvatars.length > 0 ||
        selectedProducts.length > 0 ||
        sessionState?.avatar?.id ||
        sessionState?.product?.id
      );
      if (draftStatus && draftStatus !== 'idle' && draftStatus !== 'failed') {
        setShowCloneReplacementSelectors(false);
        return;
      }
      setShowCloneReplacementSelectors(cloneStructureReplyReady || hasExistingReplacementSelection);
    }
  }, [
    awaitingCloneDraftReply,
    awaitingCloneStructureReply,
    cloneStructureReplyReady,
    sessionState?.avatar?.id,
    sessionState?.product?.id,
    sessionState?.intent,
    sessionState?.cloneReferenceVideo?.id,
    sessionState?.cloneReplacementDraft?.selectedAvatar,
    sessionState?.cloneReplacementDraft?.selectedAvatars,
    sessionState?.cloneReplacementDraft?.selectedProduct,
    sessionState?.cloneReplacementDraft?.selectedProducts,
    sessionState?.cloneReplacementDraft?.status
  ]);

  const hasAssistantReplyAfterLatestReferenceSelection = useMemo(() => {
    const referenceSelectionIndex = findLatestReferenceSelectionIndex(displayMessages);
    if (referenceSelectionIndex < 0) return false;
    return displayMessages
      .slice(referenceSelectionIndex + 1)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
  }, [displayMessages]);

  useEffect(() => {
    const hasReference = Boolean(
      sessionState?.intent === 'competitor_ugc_replication' && sessionState?.cloneReferenceVideo?.id
    );
    if (!hasReference) return;
    if (!hasAssistantReplyAfterLatestReferenceSelection) return;
    if (isStreaming || status !== 'ready') return;
    setCloneStructureReplyReady(true);
  }, [hasAssistantReplyAfterLatestReferenceSelection, isStreaming, sessionState?.intent, sessionState?.cloneReferenceVideo?.id, status]);

  useEffect(() => {
    if (!awaitingCloneStructureReply) return;

    const hasAssistantReplyAfterSelection = displayMessages
      .slice(cloneStructureReplyBaseline)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);

    if (hasAssistantReplyAfterSelection) {
      if (isStreaming || status !== 'ready') return;
      setCloneStructureReplyReady(true);
      setShowCloneReplacementSelectors(true);
      setAwaitingCloneStructureReply(false);
      return;
    }

    if (status !== 'ready') return;
    if (!isStreaming) {
      setAwaitingCloneStructureReply(false);
      requestAssistantRetry();
    }
  }, [awaitingCloneStructureReply, cloneStructureReplyBaseline, displayMessages, isStreaming, requestAssistantRetry, status]);

  const showCloneSceneWorkspaceStep = useMemo(() => {
    if (sessionState?.cloneExecution?.projectId) {
      return true;
    }
    const draftStatus = sessionState?.cloneReplacementDraft?.status;
    if (draftStatus !== 'ready' && draftStatus !== 'awaiting_confirmation') {
      return false;
    }
    return !awaitingCloneDraftReply && !isStreaming && status === 'ready';
  }, [
    awaitingCloneDraftReply,
    isStreaming,
    sessionState?.cloneExecution?.projectId,
    sessionState?.cloneReplacementDraft?.status,
    status
  ]);

  const computedPromptChipSuggestions = useMemo(() => getProjectAgentPromptChips({
    intent: sessionState?.intent,
    step: sessionState?.step,
    avatarStage: sessionState?.avatarStage,
    projectId: sessionState?.projectId,
    showCloneableVideos,
    showCloneReplacementSelectors: showCloneReplacementSelectors && !showCloneSceneWorkspaceStep,
    showCloneSceneWorkspaceStep,
    cloneReferenceVideo: sessionState?.cloneReferenceVideo
      ? { id: sessionState.cloneReferenceVideo.id }
      : null,
    cloneReplacementDraft: sessionState?.cloneReplacementDraft
      ? {
          status: sessionState.cloneReplacementDraft.status,
          scenes: sessionState.cloneReplacementDraft.scenes
        }
      : null,
    cloneExecution: sessionState?.cloneExecution
      ? {
          projectId: sessionState.cloneExecution.projectId,
          phase: sessionState.cloneExecution.phase,
          mergedVideoUrl: sessionState.cloneExecution.mergedVideoUrl
        }
      : null,
    motionClone: sessionState?.motionClone
      ? {
          stage: sessionState.motionClone.stage,
          hasSelectedAvatar: Boolean(sessionState.motionClone.selectedAvatar?.id),
          hasSelectedProduct: Boolean(sessionState.motionClone.selectedProduct?.id),
          phase: sessionState.motionClone.phase
        }
      : null
  }), [
    sessionState,
    showCloneSceneWorkspaceStep,
    showCloneReplacementSelectors,
    showCloneableVideos
  ]);
  const chatInputPlaceholder = useMemo(() => getProjectAgentInputPlaceholder({
    intent: sessionState?.intent,
    step: sessionState?.step,
    avatarStage: sessionState?.avatarStage,
    projectId: sessionState?.projectId,
    showCloneableVideos,
    showCloneReplacementSelectors: showCloneReplacementSelectors && !showCloneSceneWorkspaceStep,
    showCloneSceneWorkspaceStep,
    cloneReferenceVideo: sessionState?.cloneReferenceVideo
      ? { id: sessionState.cloneReferenceVideo.id }
      : null,
    cloneReplacementDraft: sessionState?.cloneReplacementDraft
      ? {
          status: sessionState.cloneReplacementDraft.status,
          scenes: sessionState.cloneReplacementDraft.scenes
        }
      : null,
    cloneExecution: sessionState?.cloneExecution
      ? {
          projectId: sessionState.cloneExecution.projectId,
          phase: sessionState.cloneExecution.phase,
          mergedVideoUrl: sessionState.cloneExecution.mergedVideoUrl
        }
      : null,
    motionClone: sessionState?.motionClone
      ? {
          stage: sessionState.motionClone.stage,
          hasSelectedAvatar: Boolean(sessionState.motionClone.selectedAvatar?.id),
          hasSelectedProduct: Boolean(sessionState.motionClone.selectedProduct?.id),
          phase: sessionState.motionClone.phase
        }
      : null
  }), [
    sessionState,
    showCloneSceneWorkspaceStep,
    showCloneReplacementSelectors,
    showCloneableVideos
  ]);
  const [visiblePromptChipSuggestions, setVisiblePromptChipSuggestions] = useState(computedPromptChipSuggestions);

  useEffect(() => {
    const isAvatarSelectionStage = (
      sessionState?.intent === 'avatar_ads' &&
      sessionState?.avatarStage === 'avatar_asset_selection'
    );
    const needsMentionOptions =
      isAvatarSelectionStage ||
      showCloneReplacementSelectors ||
      showCloneSceneWorkspaceStep;
    if (!needsMentionOptions) return;
    if (cloneAvatarOptions.length === 0 || cloneProductOptions.length === 0) {
      void loadCloneReplacementOptions();
    }
  }, [
    sessionState?.intent,
    sessionState?.avatarStage,
    showCloneReplacementSelectors,
    showCloneSceneWorkspaceStep,
    cloneAvatarOptions.length,
    cloneProductOptions.length,
    loadCloneReplacementOptions
  ]);

  useEffect(() => {
    const hasExplicitAvatarSelection = hasExplicitCloneAvatarSelectionState(sessionState?.cloneReplacementDraft);
    const nextSelectedAvatars = normalizeCloneSelections(
      sessionState?.cloneReplacementDraft?.selectedAvatars,
      sessionState?.cloneReplacementDraft?.selectedAvatar
    );
    if (nextSelectedAvatars.length > 0) {
      setSelectedCloneAvatarIds(nextSelectedAvatars.map((avatar) => avatar.id));
      return;
    }
    if (hasExplicitAvatarSelection) {
      setSelectedCloneAvatarIds([]);
      return;
    }
    if (sessionState?.avatar?.id) {
      setSelectedCloneAvatarIds([sessionState.avatar.id]);
      return;
    }
    setSelectedCloneAvatarIds([]);
  }, [
    sessionState?.avatar?.id,
    sessionState?.cloneReplacementDraft,
    sessionState?.cloneReplacementDraft?.selectedAvatar,
    sessionState?.cloneReplacementDraft?.selectedAvatars
  ]);

  useEffect(() => {
    const nextSelectedProducts = normalizeCloneSelections(
      sessionState?.cloneReplacementDraft?.selectedProducts,
      sessionState?.cloneReplacementDraft?.selectedProduct
    );
    if (nextSelectedProducts.length > 0) {
      setSelectedCloneProductIds(nextSelectedProducts.map((product) => product.id));
      return;
    }
    if (sessionState?.product?.id) {
      setSelectedCloneProductIds([sessionState.product.id]);
      return;
    }
    setSelectedCloneProductIds([]);
  }, [
    sessionState?.product?.id,
    sessionState?.cloneReplacementDraft?.selectedProduct,
    sessionState?.cloneReplacementDraft?.selectedProducts
  ]);

  useEffect(() => {
    if (!awaitingCloneDraftReply) return;
    if (status !== 'ready') return;
    const hasAssistantReplyAfterDraft = displayMessages
      .slice(cloneDraftReplyBaseline)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
    if (!hasAssistantReplyAfterDraft) {
      if (!isStreaming) {
        setAwaitingCloneDraftReply(false);
        requestAssistantRetry();
      }
      return;
    }
    setAwaitingCloneDraftReply(false);
  }, [awaitingCloneDraftReply, cloneDraftReplyBaseline, displayMessages, isStreaming, requestAssistantRetry, status]);

  const hasPendingInMessages = useMemo(() => {
    if (!pendingUserText) return false;
    return displayMessages.some((message) => (
      message.role === 'user' && renderUIMessageText(message).trim() === pendingUserText
    ));
  }, [displayMessages, pendingUserText]);

  const hasAssistantReplyForPendingTurn = useMemo(() => {
    if (!pendingUserText || pendingBaselineCount < 0) return false;
    return hasAssistantReplyAfterBaseline(displayMessages, pendingBaselineCount);
  }, [displayMessages, pendingBaselineCount, pendingUserText]);

  const hasUnansweredUserTurn = useMemo(() => {
    let lastUserIndex = -1;
    let lastAssistantIndex = -1;
    displayMessages.forEach((message, index) => {
      if (message.role === 'user' && renderUIMessageText(message).trim().length > 0) {
        lastUserIndex = index;
      }
      if (message.role === 'assistant' && renderUIMessageText(message).trim().length > 0) {
        lastAssistantIndex = index;
      }
    });
    return lastUserIndex > lastAssistantIndex;
  }, [displayMessages]);

  const awaitingAssistantTurn = useMemo(() => (
    Boolean(pendingUserText) ||
    isStreaming ||
    awaitingCloneEntryReply ||
    awaitingCloneStructureReply ||
    awaitingCloneDraftReply ||
    isGeneratingCloneProject
  ), [
    awaitingCloneDraftReply,
    awaitingCloneEntryReply,
    awaitingCloneStructureReply,
    isGeneratingCloneProject,
    isStreaming,
    pendingUserText
  ]);

  const shouldShowAssistantPlaceholder = useMemo(() => (
    awaitingAssistantTurn &&
    !retryableUserMessageId &&
    !hasVisibleAssistantReplyAfterLatestUserTurn(displayMessages)
  ), [
    awaitingAssistantTurn,
    displayMessages,
    retryableUserMessageId
  ]);

  useEffect(() => {
    if (awaitingAssistantTurn) return;
    if (status !== 'ready') return;
    setVisiblePromptChipSuggestions(computedPromptChipSuggestions);
  }, [awaitingAssistantTurn, computedPromptChipSuggestions, status]);

  useEffect(() => {
    if (!awaitingAssistantTurn) {
      setThinkingMessageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setThinkingMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2200);

    return () => {
      window.clearInterval(timer);
    };
  }, [awaitingAssistantTurn]);

  useEffect(() => {
    if (!pendingUserText) return;
    if (hasPendingInMessages && hasAssistantReplyForPendingTurn) {
      setPendingUserText(null);
      setPendingBaselineCount(0);
    }
  }, [displayMessages, hasAssistantReplyForPendingTurn, hasPendingInMessages, pendingUserText]);

  useEffect(() => {
    if (!retryableUserMessageId) return;
    const targetIndex = displayMessages.findIndex((message) => message.id === retryableUserMessageId);
    if (targetIndex < 0) {
      setRetryableUserMessageId(null);
      return;
    }
    const hasAssistantAfter = displayMessages
      .slice(targetIndex + 1)
      .some((message) => message.role === 'assistant' && renderUIMessageText(message).trim().length > 0);
    if (hasAssistantAfter) {
      setRetryableUserMessageId(null);
      setStatusNote('');
    }
  }, [displayMessages, retryableUserMessageId]);

  useEffect(() => {
    if (isStreaming || pendingUserText) return;
    if (statusNote) return;
    if (awaitingCloneEntryReply || awaitingCloneStructureReply || awaitingCloneDraftReply) return;
    if (displayMessages.length === 0) return;

    let lastUserIndex = -1;
    let lastAssistantIndex = -1;
    displayMessages.forEach((message, index) => {
      if (message.role === 'user') lastUserIndex = index;
      if (message.role === 'assistant' && renderUIMessageText(message).trim().length > 0) {
        lastAssistantIndex = index;
      }
    });

    if (lastUserIndex > lastAssistantIndex) {
      requestAssistantRetry();
    }
  }, [
    awaitingCloneDraftReply,
    awaitingCloneEntryReply,
    awaitingCloneStructureReply,
    displayMessages,
    isStreaming,
    pendingUserText,
    requestAssistantRetry,
    statusNote
  ]);

  const fetchCloneExecutionStatus = useCallback(async (projectId: string) => {
    const response = await fetch(`/api/competitor-ugc-replication/${projectId}/status`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload?.data) {
      throw new Error(payload?.error || 'Failed to fetch clone execution status.');
    }

    const data = payload.data as Record<string, unknown>;
    const segmentStatus = (data.segmentStatus && typeof data.segmentStatus === 'object')
      ? data.segmentStatus as Record<string, unknown>
      : null;
    const segmentsRaw = Array.isArray(data.segments) ? data.segments as Array<Record<string, unknown>> : [];
    const segments = segmentsRaw.map((segment) => ({
      segmentIndex: Number(segment.index ?? 0),
      status: typeof segment.status === 'string' ? segment.status : 'queued',
      firstFrameTaskId: typeof segment.firstFrameTaskId === 'string' ? segment.firstFrameTaskId : null,
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
      model: normalizeVideoModel(data.videoModel, 'competitor_ugc_replication'),
      duration: typeof data.videoDuration === 'string' ? data.videoDuration : undefined,
      creditsCost: typeof data.creditsUsed === 'number' ? data.creditsUsed : undefined,
      mergedVideoUrl: resolveProjectAgentCloneMergedVideoUrl({
        videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : null,
        segmentStatusMergedVideoUrl: typeof segmentStatus?.mergedVideoUrl === 'string'
          ? segmentStatus.mergedVideoUrl
          : null,
        segments,
      }),
      segments
    };
  }, []);

  const syncCloneExecutionState = useCallback(async (
    projectId: string,
    options?: { cancelled?: () => boolean }
  ) => {
    try {
      const nextExecution = await fetchCloneExecutionStatus(projectId);
      if (options?.cancelled?.()) return;

      // Treat /status as source of truth for clone execution to avoid
      // local optimistic drift (e.g. showing video-ready when DB is not ready).
      setSessionState((prev) => (
        prev
          ? {
              ...prev,
              cloneExecution: nextExecution
            }
          : prev
      ));

      // Persist authoritative clone execution snapshot so refresh restores the
      // same state instead of older session-state snapshots.
      if (sessionId) {
        await fetch('/api/project-agent/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            statePatch: { cloneExecution: nextExecution }
          })
        });
      }
    } catch {
      // Ignore intermittent sync failures.
    }
  }, [fetchCloneExecutionStatus, sessionId]);

  const persistCloneState = useCallback(async (statePatch: Record<string, unknown>) => {
    if (!sessionId) return;
    await fetch('/api/project-agent/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, statePatch })
    });
  }, [sessionId]);

  const handleCloneDraftChange = useCallback((scenes: CloneDraftScene[]) => {
    const baseDraft = latestCloneDraftRef.current ?? sessionState?.cloneReplacementDraft;
    if (!baseDraft) return;

    const nextDraft: ClonePromptDraft = {
      ...baseDraft,
      scenes
    };

    // Keep the in-flight send/generate path aligned with the latest workspace
    // edits even if React state has not committed yet.
    latestCloneDraftRef.current = nextDraft;
    lastLocalCloneDraftEditAtRef.current = Date.now();
    setSessionState((prev) => {
      if (!prev?.cloneReplacementDraft) return prev;

      if (draftPersistTimerRef.current) {
        clearTimeout(draftPersistTimerRef.current);
      }
      draftPersistTimerRef.current = setTimeout(() => {
        const persistTask = persistCloneState({ cloneReplacementDraft: nextDraft });
        pendingCloneDraftPersistRef.current = persistTask;
        void persistTask.finally(() => {
          if (pendingCloneDraftPersistRef.current === persistTask) {
            pendingCloneDraftPersistRef.current = null;
          }
        });
        draftPersistTimerRef.current = null;
      }, 600);

      return {
        ...prev,
        cloneReplacementDraft: nextDraft
      };
    });
  }, [persistCloneState, sessionState?.cloneReplacementDraft]);

  useEffect(() => () => {
    if (draftPersistTimerRef.current) {
      clearTimeout(draftPersistTimerRef.current);
      draftPersistTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    latestSessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    latestCloneDraftRef.current = sessionState?.cloneReplacementDraft ?? null;
  }, [sessionState?.cloneReplacementDraft]);

  useEffect(() => {
    if (sessionState?.intent !== 'motion_clone') return;
    setMotionPhotoPrompt(sessionState.motionClone?.photoPrompt || '');
    setMotionVideoPrompt(sessionState.motionClone?.videoPrompt || '');
  }, [sessionState?.intent, sessionState?.motionClone?.photoPrompt, sessionState?.motionClone?.videoPrompt]);

  useEffect(() => {
    if (sessionState?.intent !== 'motion_clone') return;

    const currentPhotoPrompt = sessionState.motionClone?.photoPrompt || motionPhotoPrompt;
    const currentVideoPrompt = sessionState.motionClone?.videoPrompt || motionVideoPrompt;
    const needsLegacyRewrite = (
      LEGACY_MOTION_CLONE_PROMPT_REGEX.test(currentPhotoPrompt) ||
      LEGACY_MOTION_CLONE_PROMPT_REGEX.test(currentVideoPrompt)
    );

    if (!needsLegacyRewrite) return;

    const inferredSelections = inferMotionCloneSelectionNamesFromPrompts(currentPhotoPrompt, currentVideoPrompt);
    const avatarName = sessionState.motionClone?.selectedAvatar?.name || inferredSelections.avatarName;
    const productName = sessionState.motionClone?.selectedProduct?.name || inferredSelections.productName;

    if (!avatarName) return;

    const drafts = buildMotionClonePromptDrafts({
      avatarName,
      productName,
      referenceVideo: sessionState.motionClone?.referenceVideo ?? null,
    });

    if (currentPhotoPrompt === drafts.photoPrompt && currentVideoPrompt === drafts.videoPrompt) {
      return;
    }

    setMotionPhotoPrompt(drafts.photoPrompt);
    setMotionVideoPrompt(drafts.videoPrompt);
    setSessionState((prev) => (
      prev
        ? {
            ...prev,
            motionClone: buildNextMotionCloneState(prev.motionClone, {
              photoPrompt: drafts.photoPrompt,
              videoPrompt: drafts.videoPrompt,
              promptsInitialized: true
            })
          }
        : prev
    ));
  }, [
    motionPhotoPrompt,
    motionVideoPrompt,
    sessionState?.intent,
    sessionState?.motionClone?.photoPrompt,
    sessionState?.motionClone?.referenceVideo,
    sessionState?.motionClone?.selectedAvatar?.name,
    sessionState?.motionClone?.selectedProduct?.name,
    sessionState?.motionClone?.videoPrompt
  ]);

  useEffect(() => {
    if (sessionState?.intent !== 'motion_clone') return;
    if (isMotionCloneAssetsLoading) return;
    if (motionCloneVideos.length > 0 || motionCloneAvatars.length > 0 || motionCloneProducts.length > 0) return;
    void loadMotionCloneAssets();
  }, [
    isMotionCloneAssetsLoading,
    loadMotionCloneAssets,
    motionCloneAvatars.length,
    motionCloneProducts.length,
    motionCloneVideos.length,
    sessionState?.intent
  ]);

  useEffect(() => {
    if (!sessionId) return;
    if (sessionState?.intent !== 'motion_clone') return;
    if (!sessionState.motionClone) return;

    if (motionClonePromptPersistTimerRef.current) {
      clearTimeout(motionClonePromptPersistTimerRef.current);
    }

    motionClonePromptPersistTimerRef.current = window.setTimeout(() => {
      void fetch('/api/project-agent/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statePatch: {
            motionClone: {
              ...sessionState.motionClone,
              photoPrompt: motionPhotoPrompt,
              videoPrompt: motionVideoPrompt
            }
          }
        })
      });
    }, 250);

    return () => {
      if (motionClonePromptPersistTimerRef.current) {
        clearTimeout(motionClonePromptPersistTimerRef.current);
        motionClonePromptPersistTimerRef.current = null;
      }
    };
  }, [motionPhotoPrompt, motionVideoPrompt, sessionId, sessionState?.intent, sessionState?.motionClone]);

  useEffect(() => {
    const projectId = sessionState?.cloneExecution?.projectId;
    const phase = sessionState?.cloneExecution?.phase;
    if (!projectId) return;
    if (phase === 'completed' || phase === 'failed') return;

    let cancelled = false;
    const isCancelled = () => cancelled;
    void syncCloneExecutionState(projectId, { cancelled: isCancelled });

    const channel: RealtimeChannel = supabase
      .channel(`project-agent-clone-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'competitor_ugc_replication_projects',
          filter: `id=eq.${projectId}`
        },
        () => {
          void syncCloneExecutionState(projectId, { cancelled: isCancelled });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competitor_ugc_replication_segments',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          void syncCloneExecutionState(projectId, { cancelled: isCancelled });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionState?.cloneExecution?.phase, sessionState?.cloneExecution?.projectId, supabase, syncCloneExecutionState]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    chatBottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const selectedCloneAvatars = useMemo(
    () => normalizeCloneSelections(
      sessionState?.cloneReplacementDraft?.selectedAvatars,
      sessionState?.cloneReplacementDraft?.selectedAvatar
    ),
    [sessionState?.cloneReplacementDraft?.selectedAvatar, sessionState?.cloneReplacementDraft?.selectedAvatars]
  );

  const selectedCloneProducts = useMemo(
    () => normalizeCloneSelections(
      sessionState?.cloneReplacementDraft?.selectedProducts,
      sessionState?.cloneReplacementDraft?.selectedProduct
    ),
    [sessionState?.cloneReplacementDraft?.selectedProduct, sessionState?.cloneReplacementDraft?.selectedProducts]
  );

  const characterMentions = useMemo(() => {
    const options = cloneAvatarOptions.map((avatar) => ({
      id: avatar.id,
      label: avatar.name,
      imageUrl: avatar.photoUrl || null
    }));
    selectedCloneAvatars.forEach((selected) => {
      const exists = options.some((item) => item.id === selected.id);
      if (exists) return;
      options.unshift({
        id: selected.id,
        label: selected.name,
        imageUrl: selected.photoUrl || null
      });
    });
    return options;
  }, [cloneAvatarOptions, selectedCloneAvatars]);

  const productMentions = useMemo(() => {
    const options = cloneProductOptions.map((product) => ({
      id: product.id,
      label: product.name,
      imageUrl: product.photoUrl || null
    }));
    selectedCloneProducts.forEach((selected) => {
      const exists = options.some((item) => item.id === selected.id);
      if (exists) return;
      options.unshift({
        id: selected.id,
        label: selected.name,
        imageUrl: selected.photoUrl || null
      });
    });
    return options;
  }, [cloneProductOptions, selectedCloneProducts]);

  const workspaceScenes = useMemo<WorkspaceScene[]>(() => {
    const draftScenes = sessionState?.cloneReplacementDraft?.scenes ?? [];
    const executionSegments = sessionState?.cloneExecution?.segments ?? [];
    return buildWorkspaceScenes({
      draftScenes,
      executionSegments,
      fallbackLanguage: sessionState?.language || 'en'
    });
  }, [sessionState?.cloneExecution?.segments, sessionState?.cloneReplacementDraft?.scenes, sessionState?.language]);

  const workspacePhase = useMemo(() => {
    if (sessionState?.cloneExecution?.projectId) {
      return sessionState.cloneExecution.phase === 'idle'
        ? 'draft_ready'
        : sessionState.cloneExecution.phase;
    }
    return 'draft_ready' as const;
  }, [sessionState?.cloneExecution?.phase, sessionState?.cloneExecution?.projectId]);

  const selectedMotionReferenceId = sessionState?.motionClone?.referenceVideo?.id || '';
  const selectedMotionVideo = useMemo(
    () => motionCloneVideos.find((video) => video.id === selectedMotionReferenceId) || null,
    [motionCloneVideos, selectedMotionReferenceId]
  );
  const selectedMotionAvatarId = sessionState?.motionClone?.selectedAvatar?.id || '';
  const selectedMotionProductId = sessionState?.motionClone?.selectedProduct?.id || '';
  const motionReferenceVideo = selectedMotionVideo || sessionState?.motionClone?.referenceVideo || null;
  const motionCloneDisplayDuration = motionReferenceVideo?.durationSeconds ?? sessionState?.motionClone?.durationSeconds ?? null;
  const motionCloneEstimatedCredits = getMotionCloneGenerationCost(
    motionCloneDisplayDuration,
    normalizeMotionCloneQuality(sessionState?.motionClone?.videoQuality)
  ) || 0;
  const motionCloneStage: ProjectAgentMotionCloneStage = sessionState?.motionClone?.stage || 'reference_selection';
  const motionCloneHasRequiredAvatar = Boolean(selectedMotionAvatarId);
  const motionClonePhase = sessionState?.motionClone?.phase || 'idle';
  const canGenerateMotionPreview = Boolean(
    selectedMotionReferenceId &&
    motionReferenceVideo?.coverUrl &&
    motionPhotoPrompt.trim().length > 0 &&
    motionCloneHasRequiredAvatar &&
    motionClonePhase !== 'generating_preview' &&
    motionClonePhase !== 'generating_video'
  );
  const canGenerateMotionVideo = Boolean(
    selectedMotionReferenceId &&
    motionReferenceVideo?.coverUrl &&
    motionPhotoPrompt.trim().length > 0 &&
    motionVideoPrompt.trim().length > 0 &&
    motionCloneHasRequiredAvatar &&
    motionClonePhase !== 'generating_preview' &&
    motionClonePhase !== 'generating_video'
  );
  const avatarSelection = useMemo(
    () => syncAvatarSelectionFromSession(sessionState),
    [sessionState]
  );
  const avatarStage = useMemo(
    () => inferProjectAgentAvatarStage({
      explicitStage: sessionState?.avatarStage,
      hasAvatar: Boolean(avatarSelection.avatar?.id),
      hasDraft: Boolean(sessionState?.avatarDraft?.scenes?.length),
      hasCover: Boolean(sessionState?.avatarDraft?.coverImageUrl || sessionState?.generatedImageUrl),
      projectStatus: sessionState?.step,
      currentStep: sessionState?.step,
      hasExecution: Boolean(sessionState?.avatarExecution?.projectId || sessionState?.projectId)
    }),
    [avatarSelection.avatar?.id, sessionState?.avatarDraft?.coverImageUrl, sessionState?.avatarDraft?.scenes?.length, sessionState?.avatarExecution?.projectId, sessionState?.avatarStage, sessionState?.generatedImageUrl, sessionState?.projectId, sessionState?.step]
  );
  const avatarCharacterMentions = useMemo(() => (
    avatarSelection.avatar ? [{
      id: avatarSelection.avatar.id,
      label: avatarSelection.avatar.name,
      imageUrl: avatarSelection.avatar.photoUrl
    }] : []
  ), [avatarSelection.avatar]);
  const avatarProductMentions = useMemo(() => (
    avatarSelection.product ? [{
      id: avatarSelection.product.id,
      label: avatarSelection.product.name,
      imageUrl: avatarSelection.product.photoUrl || null
    }] : []
  ), [avatarSelection.product]);
  const showAvatarAssetSelectionStep = sessionState?.intent === 'avatar_ads' && avatarStage === 'avatar_asset_selection';
  const showAvatarScriptCollectionStep = sessionState?.intent === 'avatar_ads' && avatarStage === 'avatar_script_collection';
  const showAvatarWorkspace = sessionState?.intent === 'avatar_ads' && (
    avatarStage === 'avatar_workspace' ||
    avatarStage === 'avatar_generating_cover' ||
    avatarStage === 'avatar_reviewing_cover' ||
    avatarStage === 'avatar_generating_video' ||
    avatarStage === 'avatar_completed'
  );
  const avatarWorkspaceCoverUrl = (
    sessionState?.avatarDraft?.coverImageUrl ||
    sessionState?.generatedImageUrl ||
    sessionState?.avatarExecution?.coverImageUrl ||
    null
  );
  const avatarWorkspaceFinalVideoUrl = sessionState?.avatarExecution?.finalVideoUrl || null;
  const avatarIsGeneratingCover = Boolean(
    sessionState?.avatarExecution?.phase === 'generating_cover' ||
    sessionState?.avatarStage === 'avatar_generating_cover' ||
    sessionState?.step === 'generating_image' ||
    sessionState?.step === 'regenerating_image'
  );
  const avatarIsGeneratingVideo = Boolean(
    sessionState?.avatarExecution?.phase === 'generating_videos' ||
    sessionState?.avatarStage === 'avatar_generating_video' ||
    sessionState?.step === 'generating_videos'
  );
  const showMotionCloneReferenceStep = sessionState?.intent === 'motion_clone' && motionCloneStage === 'reference_selection';
  const showMotionCloneReplacementStep = sessionState?.intent === 'motion_clone' && motionCloneStage === 'replacement_selection';
  const showMotionCloneWorkspace = sessionState?.intent === 'motion_clone' && motionCloneStage === 'workspace';
  const hasAvatarSurfaceContent = Boolean(
    showAvatarAssetSelectionStep ||
    showAvatarScriptCollectionStep ||
    showAvatarWorkspace
  );
  const hasMotionCloneSurfaceContent = Boolean(
    showMotionCloneReferenceStep ||
    showMotionCloneReplacementStep ||
    showMotionCloneWorkspace
  );

  const hasCloneSurfaceContent = sessionState?.intent === 'competitor_ugc_replication' && (
    showCloneableVideos ||
    showCloneReplacementSelectors ||
    showCloneSceneWorkspaceStep
  );
  const isCloneDraftGenerating = sessionState?.cloneReplacementDraft?.status === 'generating';
  const waitingForCloneStructureGate = Boolean(
    sessionState?.intent === 'competitor_ugc_replication' &&
    sessionState?.cloneReferenceVideo?.id &&
    !cloneStructureReplyReady &&
    selectedCloneAvatars.length === 0 &&
    selectedCloneProducts.length === 0 &&
    !sessionState?.avatar?.id &&
    !sessionState?.product?.id &&
    (sessionState?.cloneReplacementDraft?.status ?? 'idle') === 'idle' &&
    !showCloneableVideos &&
    !showCloneReplacementSelectors &&
    !showCloneSceneWorkspaceStep
  );
  const showCloneMergedResultStep = Boolean(
    showCloneSceneWorkspaceStep &&
    shouldShowProjectAgentCloneMergedReview(sessionState?.cloneExecution)
  );
  const isCloneFlowContext = (
    isCloneIntentTurn ||
    awaitingCloneEntryReply ||
    awaitingCloneStructureReply ||
    awaitingCloneDraftReply ||
    waitingForCloneStructureGate ||
    sessionState?.intent === 'competitor_ugc_replication'
  );
  const isAgentWorkflowContext = (
    isCloneFlowContext ||
    sessionState?.intent === 'motion_clone' ||
    sessionState?.intent === 'avatar_ads'
  );
  const waitingForVisibleAssistantWorkflowReply = (
    isAgentWorkflowContext &&
    (
      Boolean(pendingUserText) ||
      hasPendingInMessages ||
      hasPendingInMessages && !hasAssistantReplyForPendingTurn ||
      (
        (hasUnansweredUserTurn || awaitingAssistantTurn) &&
        !hasVisibleAssistantReplyAfterLatestUserTurn(displayMessages)
      )
    )
  );
  const shouldHoldLeftSurfaceForAssistantReply = (
    waitingForVisibleAssistantWorkflowReply &&
    !hasAvatarSurfaceContent &&
    !hasMotionCloneSurfaceContent
  );
  const hasAnyWorkflowSurfaceContent = (
    hasCloneSurfaceContent ||
    hasAvatarSurfaceContent ||
    hasMotionCloneSurfaceContent
  );
  const showLeftSurfaceContent = hasAnyWorkflowSurfaceContent && !shouldHoldLeftSurfaceForAssistantReply;
  const isWorkflowSurfacePending = !hasAnyWorkflowSurfaceContent && (
    shouldHoldLeftSurfaceForAssistantReply ||
    awaitingAssistantTurn ||
    isCloneFlowContext ||
    isCloneDraftGenerating
  );
  const shouldFlushLeftSurfaceBottomPadding = (
    showMotionCloneWorkspace ||
    showCloneSceneWorkspaceStep ||
    showAvatarWorkspace
  );

  useEffect(() => {
    scrollToBottom('auto');
  }, [sessionId, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [displayMessages, pendingUserText, isStreaming, scrollToBottom]);

  useEffect(() => {
    if (!isHistoryPopoverOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!historyPopoverRef.current?.contains(target)) {
        setIsHistoryPopoverOpen(false);
      }
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
  }, [isHistoryPopoverOpen]);

  const persistMotionCloneSessionPatch = useCallback(async (statePatch: Record<string, unknown>, projectId?: string | null) => {
    if (!sessionId) return;
    await fetch('/api/project-agent/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        statePatch,
        projectId: projectId ?? undefined
      })
    });
  }, [sessionId]);

  const handleMotionReferenceSelection = useCallback(async (id: string) => {
    if (!sessionId || sendLocked) return;

    const selectedReference = motionCloneVideos.find((video) => video.id === id);
    if (!selectedReference?.coverUrl) {
      setStatusNote('This reference video needs a first frame before Motion Clone can use it.');
      return;
    }

    const referenceContext = inferMotionCloneReferenceContext(selectedReference.analysisResult);
    const enrichedReference: ProjectAgentMotionCloneReferenceVideo = {
      ...selectedReference,
      analysisSummary: selectedReference.analysisSummary ?? referenceContext.summary,
      keyShots: selectedReference.keyShots ?? referenceContext.keyShots,
      detectedCharacter: selectedReference.detectedCharacter ?? referenceContext.detectedCharacter,
      detectedProduct: selectedReference.detectedProduct ?? referenceContext.detectedProduct,
    };

    const referenceName =
      selectedReference.source_name ||
      selectedReference.description ||
      `Video ${selectedReference.id.slice(0, 8)}`;
    const referenceSelectionMessage = `I selected "${referenceName}" as the reference video for motion clone.`;
    const pendingBaseline = messages.length;

    setStatusNote('');
    setPendingUserText(referenceSelectionMessage);
    setPendingBaselineCount(pendingBaseline);
    const nextMotionClone = buildNextMotionCloneState(sessionState?.motionClone, {
      stage: 'replacement_selection',
      phase: 'idle',
      referenceVideo: enrichedReference,
      selectedAvatar: null,
      selectedProduct: null,
      photoPrompt: null,
      videoPrompt: null,
      previewImageUrl: null,
      outputVideoUrl: null,
      projectId: null,
      promptsInitialized: false,
      error: null
    });
    setSessionState((prev) => (
      prev
        ? { ...prev, intent: 'motion_clone', motionClone: nextMotionClone }
        : { intent: 'motion_clone', motionClone: nextMotionClone }
    ));
    try {
      await persistMotionCloneSessionPatch({
        intent: 'motion_clone',
        motionClone: nextMotionClone
      });
    } catch (patchError) {
      console.error('Failed to persist selected motion clone reference:', patchError);
      setStatusNote('Failed to save selected reference video. Please retry.');
      setPendingUserText(null);
      setPendingBaselineCount(0);
      return;
    }
    try {
      clearError();
      setStatusNote('');
      ensureHistoryTracked(sessionId);
      const sent = await sendMessageSafely(referenceSelectionMessage);
      if (!sent) {
        setPendingUserText(null);
        setPendingBaselineCount(0);
      }
    } catch (chatSendError) {
      console.error('Failed to send motion clone reference selection message to chat stream:', chatSendError);
      setPendingUserText(null);
      setPendingBaselineCount(0);
    }
  }, [
    clearError,
    ensureHistoryTracked,
    messages,
    motionCloneVideos,
    persistMotionCloneSessionPatch,
    sendLocked,
    sendMessageSafely,
    sessionId,
    sessionState?.motionClone
  ]);

  const handleSelectVideoFromDetails = useCallback(async (video: CloneableVideoAsset) => {
    if (sessionState?.intent === 'motion_clone') {
      await handleMotionReferenceSelection(video.id);
      return;
    }

    await handleSelectCloneReference(video);
  }, [handleMotionReferenceSelection, handleSelectCloneReference, sessionState?.intent]);

  const videoDetailsCloneActionLabel = sessionState?.intent === 'motion_clone'
    ? 'Use for Motion Clone'
    : 'Select This Video';

  const handleMotionSelectionToggle = useCallback(async (kind: 'avatar' | 'product', id: string) => {
    if (!sessionId || sendLocked) return;

    if (kind === 'avatar') {
      const avatar = motionCloneAvatars.find((item) => item.id === id);
      if (!avatar) return;
      const isSame = sessionState?.motionClone?.selectedAvatar?.id === id;
      const nextSelectedAvatar: ProjectAgentMotionCloneSelection | null = isSame
        ? null
        : {
            id: avatar.id,
            name: avatar.avatar_name || 'Avatar',
            photoUrl: avatar.photo_url
          };
      const nextMotionClone = buildNextMotionCloneState(sessionState?.motionClone, {
        selectedAvatar: nextSelectedAvatar,
        error: null
      });
      setSessionState((prev) => prev ? {
        ...prev,
        avatar: nextSelectedAvatar ? {
          id: nextSelectedAvatar.id,
          name: nextSelectedAvatar.name,
          photoUrl: nextSelectedAvatar.photoUrl || ''
        } : null,
        motionClone: nextMotionClone
      } : prev);
      await persistMotionCloneSessionPatch({
        avatar: nextSelectedAvatar ? {
          id: nextSelectedAvatar.id,
          name: nextSelectedAvatar.name,
          photoUrl: nextSelectedAvatar.photoUrl || ''
        } : null,
        motionClone: nextMotionClone
      });
      return;
    }

    const product = motionCloneProducts.find((item) => item.id === id);
    if (!product) return;
    const photos = product.user_product_photos || [];
    const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];
    const isSame = sessionState?.motionClone?.selectedProduct?.id === id;
    const nextSelectedProduct: ProjectAgentMotionCloneSelection | null = isSame
      ? null
      : {
          id: product.id,
          name: product.product_name,
          photoUrl: primaryPhoto?.photo_url || null
        };
    const nextMotionClone = buildNextMotionCloneState(sessionState?.motionClone, {
      selectedProduct: nextSelectedProduct,
      error: null
    });
    setSessionState((prev) => prev ? {
      ...prev,
      product: nextSelectedProduct ? {
        id: nextSelectedProduct.id,
        name: nextSelectedProduct.name
      } : null,
      motionClone: nextMotionClone
    } : prev);
    await persistMotionCloneSessionPatch({
      product: nextSelectedProduct ? {
        id: nextSelectedProduct.id,
        name: nextSelectedProduct.name
      } : null,
      motionClone: nextMotionClone
    });
  }, [
    motionCloneAvatars,
    motionCloneProducts,
    persistMotionCloneSessionPatch,
    sendLocked,
    sessionId,
    sessionState?.motionClone
  ]);

  const ensureMotionCloneProject = useCallback(async () => {
    const existingProjectId = sessionState?.motionClone?.projectId;
    if (existingProjectId) return existingProjectId;

    const response = await fetch('/api/motion-clone/create', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.project?.id) {
      throw new Error(payload?.error || 'Failed to create motion clone project.');
    }

    const nextMotionClone = buildNextMotionCloneState(sessionState?.motionClone, {
      projectId: payload.project.id,
      phase: 'idle',
      status: payload.project.status ?? 'pending'
    });
    setSessionState((prev) => prev ? {
      ...prev,
      intent: 'motion_clone',
      projectId: payload.project.id,
      motionClone: nextMotionClone
    } : prev);
    await persistMotionCloneSessionPatch({
      intent: 'motion_clone',
      motionClone: nextMotionClone
    }, payload.project.id);

    return payload.project.id as string;
  }, [persistMotionCloneSessionPatch, sessionState?.motionClone]);

  const handleStartMotionClone = useCallback(async (action: 'image' | 'video') => {
    try {
      setStatusNote('');
      const projectId = await ensureMotionCloneProject();
      const response = await fetch(`/api/motion-clone/${projectId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_video_id: selectedMotionReferenceId,
          avatar_id: selectedMotionAvatarId || undefined,
          product_id: selectedMotionProductId || undefined,
          photo_prompt: motionPhotoPrompt,
          video_prompt: motionVideoPrompt,
          mode: normalizeMotionCloneQuality(sessionState?.motionClone?.videoQuality),
          action
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.project) {
        throw new Error(payload?.error || `Failed to start Motion Clone ${action}.`);
      }

      const nextMotionClone = buildNextMotionCloneState(sessionState?.motionClone, {
        projectId,
        phase: payload.project.status === 'generating_video'
          ? 'generating_video'
          : payload.project.status === 'generating_preview'
            ? 'generating_preview'
            : payload.project.status === 'preview_ready'
              ? 'preview_ready'
              : payload.project.status === 'completed'
                ? 'completed'
                : payload.project.status === 'failed'
                  ? 'failed'
                  : 'idle',
        status: payload.project.status ?? null,
        previewImageUrl: payload.project.preview_image_url ?? null,
        outputVideoUrl: payload.project.output_video_url ?? null,
        photoPrompt: payload.project.photo_prompt ?? motionPhotoPrompt,
        videoPrompt: payload.project.video_prompt ?? motionVideoPrompt,
        videoQuality: normalizeMotionCloneQuality(payload.project.mode),
        durationSeconds: payload.project.reference_duration_seconds ?? motionCloneDisplayDuration ?? null,
        creditsCost: payload.project.credits_cost ?? motionCloneEstimatedCredits,
        error: payload.project.error_message ?? null,
        referenceVideo: motionReferenceVideo,
        selectedAvatar: sessionState?.motionClone?.selectedAvatar ?? null,
        selectedProduct: sessionState?.motionClone?.selectedProduct ?? null
      });
      setSessionState((prev) => prev ? {
        ...prev,
        projectId,
        motionClone: nextMotionClone
      } : prev);
      await persistMotionCloneSessionPatch({ motionClone: nextMotionClone }, projectId);
    } catch (motionStartError) {
      setStatusNote(motionStartError instanceof Error ? motionStartError.message : 'Failed to start Motion Clone.');
    }
  }, [
    ensureMotionCloneProject,
    motionCloneDisplayDuration,
    motionCloneEstimatedCredits,
    motionPhotoPrompt,
    motionReferenceVideo,
    motionVideoPrompt,
    persistMotionCloneSessionPatch,
    selectedMotionAvatarId,
    selectedMotionProductId,
    selectedMotionReferenceId,
    sessionState?.motionClone
  ]);

  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  return (
    <div className="project-agent-page h-[100dvh] overflow-hidden bg-white">
      <Sidebar
        credits={credits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <DashboardContentTransition className="dashboard-content-offset h-[100dvh] overflow-hidden min-h-0 bg-white">
        <div className="h-full box-border min-h-0 p-3 md:py-3 md:pr-3 md:pl-0">
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <section className="project-agent-surface relative h-full min-h-0 overflow-hidden rounded-xl border border-[#e6e6e4] bg-white">
              <div
                className={
                  showLeftSurfaceContent
                    ? [
                        'flex h-full min-h-0 flex-col overflow-y-auto px-4 md:px-6',
                        shouldFlushLeftSurfaceBottomPadding ? 'pt-4 pb-0 md:pt-5 md:pb-0' : 'py-4 md:py-5',
                      ].join(' ')
                    : 'h-full grid place-items-center px-6'
                }
              >
                {showLeftSurfaceContent ? (
                  <div className="flex w-full min-h-full flex-1 flex-col gap-4">
                    {showAvatarAssetSelectionStep ? (
                      <div className="rounded-xl border border-[#e6e6e4] bg-white p-5 space-y-6">
                        <div>
                          <p className="text-2xl font-semibold tracking-[-0.02em] text-[#1f1f1e]">Choose your avatar</p>
                          <p className="mt-1 text-sm text-[#787876]">Add a product only if the ad needs one.</p>
                        </div>

                        {isCloneOptionsLoading ? (
                          <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                            Loading avatar and product options...
                          </div>
                        ) : (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#1f1f1e]">
                                  <User className="h-3.5 w-3.5" />
                                  <span>Avatar</span>
                                </p>
                              </div>
                              {cloneAvatarOptions.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-5 text-center text-xs text-[#787876]">
                                  No avatars are available yet.
                                </div>
                              ) : (
                                <div className="relative z-10 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                                  {cloneAvatarOptions.map((avatar) => {
                                    const isSelected = avatarSelection.avatar?.id === avatar.id;
                                    return (
                                      <button
                                        key={avatar.id}
                                        type="button"
                                        onClick={() => void handleAvatarSelectionToggle(avatar.id)}
                                        aria-label={`Select avatar ${avatar.name}`}
                                        className={`project-agent-selection-card relative z-10 pointer-events-auto rounded-xl p-1.5 text-left transition-colors ${isSelected ? 'project-agent-selection-card--selected border-2 border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.04)]' : 'project-agent-selection-card--idle border border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                      >
                                        <div className="project-agent-selection-media mb-1 aspect-square w-full overflow-hidden rounded-[10px] bg-[#efefed]">
                                          {avatar.photoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={avatar.photoUrl} alt={avatar.name} className="h-full w-full object-cover" />
                                          ) : null}
                                        </div>
                                        <span
                                          className={`project-agent-selection-chip inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-medium ${isSelected ? 'project-agent-selection-chip--selected bg-[#0f0f0f] text-white' : 'project-agent-selection-chip--idle bg-[#f3f3f2] text-[#1f1f1e]'}`}
                                        >
                                          <span className="truncate">{avatar.name}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2.5">
                                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#1f1f1e]">
                                  <Package className="h-3.5 w-3.5" />
                                  <span>Product</span>
                                </p>
                                <span className="text-[11px] font-medium uppercase tracking-wide text-[#8d8d8a]">Optional</span>
                              </div>
                              {cloneProductOptions.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-5 text-center text-xs text-[#787876]">
                                  No products are available in Assets yet.
                                </div>
                              ) : (
                                <div className="relative z-10 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                                  {cloneProductOptions.map((product) => {
                                    const isSelected = avatarSelection.product?.id === product.id;
                                    return (
                                      <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => void handleAvatarProductSelectionToggle(product.id)}
                                        aria-label={`Select product ${product.name}`}
                                        className={`project-agent-selection-card relative z-10 pointer-events-auto rounded-xl p-1.5 text-left transition-colors ${isSelected ? 'project-agent-selection-card--selected border-2 border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.04)]' : 'project-agent-selection-card--idle border border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                      >
                                        <div className="project-agent-selection-media mb-1 aspect-square w-full overflow-hidden rounded-[10px] bg-[#efefed]">
                                          {product.photoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={product.photoUrl} alt={product.name} className="h-full w-full object-cover" />
                                          ) : null}
                                        </div>
                                        <span
                                          className={`project-agent-selection-chip inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-medium ${isSelected ? 'project-agent-selection-chip--selected bg-[#0f0f0f] text-white' : 'project-agent-selection-chip--idle bg-[#f3f3f2] text-[#1f1f1e]'}`}
                                        >
                                          <span className="truncate">{product.name}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {showAvatarScriptCollectionStep ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#e6e6e4] bg-white p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Avatar Ads</p>
                          <p className="mt-1 text-sm font-medium text-[#1f1f1e]">Step 2: Collect the spoken script in chat</p>
                          <p className="mt-1 text-xs text-[#787876]">
                            The avatar is selected. Next the agent should ask what the avatar should say. If you want Flowgen to decide, answer in chat with the product benefits or say that it should draft the script for you.
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg border border-[#ececea] bg-[#fafaf9] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-[#8d8d8a]">Avatar</p>
                              <p className="mt-1 text-sm font-medium text-[#1f1f1e]">{avatarSelection.avatar?.name || 'Not selected'}</p>
                            </div>
                            <div className="rounded-lg border border-[#ececea] bg-[#fafaf9] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-[#8d8d8a]">Product</p>
                              <p className="mt-1 text-sm font-medium text-[#1f1f1e]">{avatarSelection.product?.name || 'Talking-head mode'}</p>
                            </div>
                            <div className="rounded-lg border border-[#ececea] bg-[#fafaf9] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-[#8d8d8a]">Settings</p>
                              <p className="mt-1 text-sm font-medium text-[#1f1f1e]">
                                {avatarSelection.durationSeconds || 16}s · {avatarSelection.aspectRatio || '9:16'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[#ececea] bg-[#fafaf9] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-[#8d8d8a]">Stage</p>
                              <p className="mt-1 text-sm font-medium text-[#1f1f1e]">{normalizeProjectAgentAvatarStage(avatarStage).replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
                          <div className="rounded-xl border border-[#e6e6e4] bg-white p-4">
                            <p className="text-sm font-medium text-[#1f1f1e]">What happens next</p>
                            <p className="mt-1 text-xs text-[#787876]">
                              Once the script is provided or drafted, this area becomes the inline workspace with cover and video previews on the left.
                            </p>
                            <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5]">
                              <div className="aspect-[9/16] flex items-center justify-center px-5 text-center text-sm text-[#787876]">
                                Waiting for the script step to finish before opening the workspace.
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#e6e6e4] bg-white p-4">
                            <p className="text-sm font-medium text-[#1f1f1e]">Suggested chat replies</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[
                                'Write a 16-second script for this avatar.',
                                'I want a friendly UGC-style pitch.',
                                'Use this product and draft the script for me.'
                              ].map((message) => (
                                <button
                                  key={message}
                                  type="button"
                                  onClick={() => void handleAvatarAssetSelectionMessage(message)}
                                  className="inline-flex items-center rounded-full border border-[#d9d9d7] bg-[#f7f7f5] px-3 py-1.5 text-xs font-medium text-[#4c4c49] transition hover:border-[#bfbfbb] hover:bg-white"
                                >
                                  {message}
                                </button>
                              ))}
                            </div>
                            {sessionState?.avatarDraft?.scriptSource ? (
                              <div className="mt-4 rounded-lg border border-[#ececea] bg-[#fafaf9] p-3 text-sm text-[#4f4f4d]">
                                {sessionState.avatarDraft.scriptSource}
                              </div>
                            ) : (
                              <div className="mt-4 rounded-lg border border-dashed border-[#dfdfdc] bg-[#f7f7f5] p-3 text-sm text-[#787876]">
                                No script draft yet. The assistant should stay in conversation mode here instead of opening the editor early.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {showAvatarWorkspace ? (
                      <div className="flex h-full min-h-0 flex-col">
                        <div className="flex h-full min-h-0 flex-col rounded-xl border border-[#e6e6e4] bg-white p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 3 Workspace</p>
                          <p className="mt-1 text-sm font-medium text-[#1f1f1e]">Avatar workspace</p>

                          <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
                            <div className="grid h-full min-h-0 grid-cols-2 gap-2.5">
                              <div className="flex min-w-0 min-h-0 flex-col">
                                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#666666]">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  Generated Cover
                                </div>
                                <div className="relative flex-1 overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] min-h-[420px]">
                                  {avatarIsGeneratingCover ? (
                                    <div className="relative flex h-full w-full overflow-hidden bg-[#f3f3f3]">
                                      <div className="avatar-workspace-wave absolute inset-0 opacity-90" />
                                      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center text-sm text-[#666666]">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                                        <span className="mt-2 font-medium text-[#444444]">
                                          Generating image...
                                        </span>
                                        <span className="mt-1 text-xs text-[#777777]">
                                          Usually takes around 10-20 seconds.
                                        </span>
                                      </div>
                                    </div>
                                  ) : avatarWorkspaceCoverUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={avatarWorkspaceCoverUrl}
                                      alt="Generated avatar cover"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[#666666]">
                                      <ImageIcon className="h-6 w-6 text-[#8d8d8a]" />
                                      <span>Cover generation has not started.</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex min-w-0 min-h-0 flex-col">
                                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#666666]">
                                  <VideoIcon className="h-3.5 w-3.5" />
                                  Final Video
                                </div>
                                <div className="relative flex-1 overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] min-h-[420px]">
                                  {avatarIsGeneratingVideo ? (
                                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-sm text-[#666666]">
                                      <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                                      <span className="mt-2">Rendering video...</span>
                                    </div>
                                  ) : avatarWorkspaceFinalVideoUrl ? (
                                    <video
                                      src={avatarWorkspaceFinalVideoUrl}
                                      controls
                                      playsInline
                                      className="h-full w-full rounded-lg bg-black object-contain"
                                    />
                                  ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[#666666]">
                                      <VideoIcon className="h-6 w-6 text-[#8d8d8a]" />
                                      <span>Video generation has not started.</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="h-full min-h-0">
                              <AvatarWorkspaceEditor
                                draft={sessionState?.avatarDraft}
                                characterMentions={avatarCharacterMentions}
                                productMentions={avatarProductMentions}
                                onDraftChange={(nextDraft) => {
                                const nextPromptState = buildAvatarGeneratedPrompts({
                                  imagePrompt: nextDraft.imagePrompt,
                                  scriptSource: nextDraft.scriptSource,
                                  existingScenes: nextDraft.scenes,
                                  language: sessionState?.avatarSelection?.language ?? sessionState?.language ?? 'en',
                                  avatarName: avatarSelection.avatar?.name ?? null,
                                  productName: avatarSelection.product?.name ?? null
                                });
                                  setSessionState((prev) => prev ? {
                                    ...prev,
                                    videoDurationSeconds: nextPromptState.totalDurationSeconds,
                                    avatarSelection: prev.avatarSelection ? {
                                      ...prev.avatarSelection,
                                      durationSeconds: nextPromptState.totalDurationSeconds
                                    } : prev.avatarSelection,
                                  avatarDraft: {
                                    ...nextDraft,
                                    imagePrompt: nextPromptState.generatedPrompts.image_prompt as string,
                                    scenes: nextPromptState.scenes
                                  },
                                  generatedPrompts: nextPromptState.generatedPrompts,
                                    imagePrompt: nextPromptState.generatedPrompts.image_prompt as string,
                                    pendingUpdatedPrompts: nextPromptState.generatedPrompts
                                  } : prev);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {showMotionCloneReferenceStep ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#e6e6e4] bg-white p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Motion Clone</p>
                          <p className="mt-1 text-sm font-medium text-[#1f1f1e]">Step 1: Choose a reference video</p>
                          <p className="mt-1 text-xs text-[#787876]">
                            Pick one eligible creator video first. After that, you will choose the replacement person and optional product.
                          </p>
                          <div className="mt-4">
                            {isMotionCloneAssetsLoading && motionCloneVideos.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                                Loading your video assets...
                              </div>
                            ) : motionCloneVideos.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                                No eligible videos found in Assets yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                                {motionCloneVideos.map((video) => (
                                  <div
                                    key={video.id}
                                    onClick={() => void handleMotionReferenceSelection(video.id)}
                                    className={`rounded-2xl transition ${
                                      selectedMotionReferenceId === video.id
                                        ? 'ring-2 ring-[#111111] ring-offset-2 ring-offset-[#fbfbfa]'
                                        : ''
                                    }`}
                                  >
                                    <VideoAssetCard
                                      video={{
                                        id: video.id,
                                        source_id: video.source_id ?? video.id,
                                        source_name: video.source_name ?? null,
                                        source_type: video.source_type ?? 'creator',
                                        video_url: video.videoUrl || '',
                                        video_cdn_url: video.videoCdnUrl || null,
                                        cover_url: video.coverUrl || null,
                                        description: video.description || null,
                                        duration_seconds: video.durationSeconds || null,
                                        platform: video.platform || 'tiktok',
                                        analysis_status: video.analysisStatus || null,
                                        analysis_result: video.analysisResult || null,
                                        analysis_error: video.analysisError || null,
                                        analysis_language: video.analysisLanguage || null,
                                      }}
                                      compact
                                      onViewDetails={() => {
                                        setSelectedVideo({
                                          id: video.id,
                                          source_id: video.source_id ?? video.id,
                                          source_name: video.source_name ?? null,
                                          source_type: video.source_type ?? 'creator',
                                          video_url: video.videoUrl || '',
                                          video_cdn_url: video.videoCdnUrl || null,
                                          cover_url: video.coverUrl || null,
                                          description: video.description || null,
                                          duration_seconds: video.durationSeconds || null,
                                          platform: video.platform || 'tiktok',
                                          analysis_status: video.analysisStatus || null,
                                          analysis_result: video.analysisResult || null,
                                          analysis_error: video.analysisError || null,
                                          analysis_language: video.analysisLanguage || null,
                                        });
                                        setShowVideoDetails(true);
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {showMotionCloneReplacementStep ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#e6e6e4] bg-white p-4 space-y-4">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Motion Clone</p>
                            <p className="mt-1 text-sm font-medium text-[#1f1f1e]">Step 2: Choose the replacement person</p>
                            <p className="mt-1 text-xs text-[#787876]">A person is required before agent confirmation. Product is optional.</p>
                          </div>
                          {isMotionCloneAssetsLoading ? (
                            <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                              Loading motion clone assets...
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#1f1f1e]">
                                  <User className="h-3.5 w-3.5" />
                                  <span>Avatar</span>
                                </p>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                                  {motionCloneAvatars.map((avatar) => (
                                    <button
                                      key={avatar.id}
                                      type="button"
                                      onClick={() => void handleMotionSelectionToggle('avatar', avatar.id)}
                                      className={`rounded-xl border p-1.5 text-left ${selectedMotionAvatarId === avatar.id ? 'border-[#111111] bg-white' : 'border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                    >
                                      <div className="mb-1 aspect-square overflow-hidden rounded-[10px] bg-[#efefed]">
                                        {avatar.photo_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={avatar.photo_url} alt={avatar.avatar_name} className="h-full w-full object-cover" />
                                        ) : null}
                                      </div>
                                      <span className="inline-flex max-w-full rounded-md bg-[#f3f3f2] px-2 py-1 text-[11px] font-medium text-[#1f1f1e]">
                                        <span className="truncate">{avatar.avatar_name}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#1f1f1e]">
                                  <Package className="h-3.5 w-3.5" />
                                  <span>Product</span>
                                </p>
                                <p className="text-xs text-[#787876]">Optional. Add a product only if you want to swap it too.</p>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                                  {motionCloneProducts.map((product) => {
                                    const primaryPhoto = product.user_product_photos?.find((photo) => photo.is_primary) || product.user_product_photos?.[0];
                                    return (
                                      <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => void handleMotionSelectionToggle('product', product.id)}
                                        className={`rounded-xl border p-1.5 text-left ${selectedMotionProductId === product.id ? 'border-[#111111] bg-white' : 'border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                      >
                                        <div className="mb-1 aspect-square overflow-hidden rounded-[10px] bg-[#efefed]">
                                          {primaryPhoto?.photo_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={primaryPhoto.photo_url} alt={product.product_name} className="h-full w-full object-cover" />
                                          ) : null}
                                        </div>
                                        <span className="inline-flex max-w-full rounded-md bg-[#f3f3f2] px-2 py-1 text-[11px] font-medium text-[#1f1f1e]">
                                          <span className="truncate">{product.product_name}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {showMotionCloneWorkspace ? (
                      <div className="flex min-h-full flex-col gap-4">
                        <div className="rounded-xl border border-[#e6e6e4] bg-white p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Motion Clone</p>
                          <p className="mt-1 text-sm font-medium text-[#1f1f1e]">Step 3: Review auto-generated prompts</p>
                          <p className="mt-1 text-xs text-[#787876]">
                            Prompts were generated automatically from your selected reference, avatar, and product. Use chat to confirm when Flowgen should generate or regenerate.
                          </p>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e6e6e4] bg-white p-2">
                          <MotionCloneEditorSplitPane
                            firstFrameUrl={sessionState?.motionClone?.previewImageUrl || motionReferenceVideo?.coverUrl || null}
                            originalVideoUrl={motionReferenceVideo?.videoCdnUrl || motionReferenceVideo?.videoUrl || null}
                            generatedVideoUrl={sessionState?.motionClone?.outputVideoUrl || null}
                            videoAspectRatio="9:16"
                            isGeneratingImage={motionClonePhase === 'generating_preview'}
                            isGeneratingVideo={motionClonePhase === 'generating_video'}
                            form={(
                              <MotionCloneEditorFormColumn
                                photoPrompt={motionPhotoPrompt}
                                onPhotoPromptChange={setMotionPhotoPrompt}
                                videoPrompt={motionVideoPrompt}
                                onVideoPromptChange={setMotionVideoPrompt}
                                avatars={motionCloneAvatars}
                                products={motionCloneProducts}
                                onGenerateImage={() => void handleStartMotionClone('image')}
                                onGenerateVideo={() => void handleStartMotionClone('video')}
                                canGenerateImage={canGenerateMotionPreview}
                                canGenerateVideo={canGenerateMotionVideo}
                                isGeneratingImage={motionClonePhase === 'generating_preview'}
                                isGeneratingVideo={motionClonePhase === 'generating_video'}
                                videoCreditsCost={sessionState?.motionClone?.creditsCost || motionCloneEstimatedCredits}
                                creditsIcon={<Coins className="h-3.5 w-3.5" />}
                                hideActions
                              />
                            )}
                          />
                        </div>
                      </div>
                    ) : null}

                    {sessionState?.intent === 'competitor_ugc_replication' && showCloneableVideos && (
                    <div className="project-agent-card w-full rounded-xl border border-[#e6e6e4] bg-white p-4">
                      <div className="mb-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f1f1e]">Step 1: Choose Reference Video</p>
                          <p className="text-xs text-[#787876]">Select one video from Assets first. Product selection comes later.</p>
                        </div>
                      </div>

                      {isCloneableVideosLoading && cloneableVideos.length === 0 ? (
                        <div className="project-agent-empty rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                          Loading your video assets...
                        </div>
                      ) : cloneableVideos.length === 0 ? (
                        <div className="project-agent-empty rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
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

                    {sessionState?.intent === 'competitor_ugc_replication' && showCloneReplacementSelectors && !showCloneSceneWorkspaceStep && (
                    <div className="project-agent-card relative isolate w-full rounded-xl border border-[#e6e6e4] bg-white p-4 space-y-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 2</p>
                        <p className="text-sm font-medium text-[#4f4f4d]">Choose replacement avatar and/or product</p>
                        <p className="mt-1 text-xs text-[#787876]">Pick the parts you want to replace. You can continue with an avatar, a product, or both.</p>
                      </div>

                      {sessionState?.cloneReplacementDraft?.status === 'failed' && sessionState.cloneReplacementDraft.error ? (
                        <div className="project-agent-warning rounded-xl border border-[#ead2cf] bg-[#fff7f5] px-4 py-3 text-xs text-[#8a4d45]">
                          Draft prep failed: {sessionState.cloneReplacementDraft.error}
                        </div>
                      ) : null}

                      {isCloneOptionsLoading ? (
                        <div className="project-agent-empty rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
                          Loading avatar and product options...
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f1f1e] uppercase tracking-wide">
                                <User className="h-3.5 w-3.5" />
                                <span>Choose Avatars</span>
                              </p>
                            </div>
                            <p className="text-xs text-[#787876]">Optional. Select one or more if you want to replace the person in the reference.</p>
                            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                              {cloneAvatarOptions.map((avatar) => (
                                <button
                                  key={avatar.id}
                                  type="button"
                                  onClick={() => handleManualAvatarSelection(avatar.id)}
                                  className={`project-agent-selection-card relative z-10 pointer-events-auto rounded-xl p-1.5 text-left transition-colors ${selectedCloneAvatarIds.includes(avatar.id) ? 'project-agent-selection-card--selected border-2 border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.04)]' : 'project-agent-selection-card--idle border border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                >
                                  <div className="project-agent-selection-media mb-1 w-full aspect-square overflow-hidden rounded-[10px] bg-[#efefed]">
                                    {avatar.photoUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={avatar.photoUrl} alt={avatar.name} className="w-full h-full object-cover" />
                                    ) : null}
                                  </div>
                                  <span
                                    className={`project-agent-selection-chip inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-medium ${selectedCloneAvatarIds.includes(avatar.id) ? 'project-agent-selection-chip--selected bg-[#0f0f0f] text-white' : 'project-agent-selection-chip--idle bg-[#f3f3f2] text-[#1f1f1e]'}`}
                                  >
                                    <span className="truncate">{avatar.name}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f1f1e] uppercase tracking-wide">
                                <Package className="h-3.5 w-3.5" />
                                <span>Choose Products</span>
                              </p>
                            </div>
                            <p className="text-xs text-[#787876]">Optional. Select one or more if you want to replace the product in the reference.</p>
                            {cloneProductOptions.length === 0 ? (
                              <div className="project-agent-empty rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-5 text-center text-xs text-[#787876]">
                                No products are available in Assets yet. Product replacement is optional, so you can still continue with avatar-only replacement.
                              </div>
                            ) : (
                              <>
                                <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                                  {cloneProductOptions.map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      onClick={() => handleManualProductSelection(product.id)}
                                      className={`project-agent-selection-card relative z-10 pointer-events-auto rounded-xl p-1.5 text-left transition-colors ${selectedCloneProductIds.includes(product.id) ? 'project-agent-selection-card--selected border-2 border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.04)]' : 'project-agent-selection-card--idle border border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                    >
                                      <div className="project-agent-selection-media mb-1 w-full aspect-square overflow-hidden rounded-[10px] bg-[#efefed]">
                                        {product.photoUrl ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                                        ) : null}
                                      </div>
                                      <span
                                        className={`project-agent-selection-chip inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-medium ${selectedCloneProductIds.includes(product.id) ? 'project-agent-selection-chip--selected bg-[#0f0f0f] text-white' : 'project-agent-selection-chip--idle bg-[#f3f3f2] text-[#1f1f1e]'}`}
                                      >
                                        <span className="truncate">{product.name}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>

                        </>
                      )}
                    </div>
                    )}

                    {sessionState?.intent === 'competitor_ugc_replication' && showCloneSceneWorkspaceStep && !showCloneMergedResultStep ? (
                      <div className="space-y-3">
                      <CloneSceneWorkspaceStep
                        phase={workspacePhase}
                        scenes={workspaceScenes}
                        characterMentions={characterMentions}
                        productMentions={productMentions}
                        preferredFrameRegeneratingSceneIndex={preferredRegeneratingSceneIndex}
                        onScenesChange={(nextScenes) => {
                          const nextDraftScenes = nextScenes.map(workspacePromptToDraftScene);
                          handleCloneDraftChange(nextDraftScenes);
                        }}
                      />
                      </div>
                    ) : null}

                    {sessionState?.intent === 'competitor_ugc_replication' && showCloneMergedResultStep && sessionState?.cloneExecution ? (
                      <CloneMergedVideoReviewStep
                        execution={sessionState.cloneExecution}
                        characterMentions={characterMentions}
                        productMentions={productMentions}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="w-full max-w-[640px] text-center">
                    <div className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e6e6e4] bg-white">
                      {isWorkflowSurfacePending || shouldHoldLeftSurfaceForAssistantReply ? (
                        <Loader2 className="h-4.5 w-4.5 animate-spin text-[#525251]" />
                      ) : (
                        <Sparkles className="h-4.5 w-4.5 text-[#525251]" />
                      )}
                    </div>
                    <p className="text-[17px] font-medium text-[#1f1f1e]">
                      {isWorkflowSurfacePending || shouldHoldLeftSurfaceForAssistantReply ? 'Working on it...' : 'Ready when you are.'}
                    </p>
                    <p className="mt-2 text-sm text-[#7a7a77]">
                      {isWorkflowSurfacePending || shouldHoldLeftSurfaceForAssistantReply
                        ? 'Preparing the next step for this workflow.'
                        : 'Choose one workflow to start instantly.'}
                    </p>
                    {!isWorkflowSurfacePending && !shouldHoldLeftSurfaceForAssistantReply ? (
                      <>
                        <div className="project-agent-card mx-auto mt-5 w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#e6e6e4] bg-white">
                          <div className="aspect-video w-full bg-black">
                            <iframe
                              className="h-full w-full"
                              src={PROJECT_AGENT_TUTORIAL_EMBED_URL}
                              title="Flowtra AI Agent tutorial"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <section className="project-agent-chat-surface flowgen-chat-font flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e6e6e4] bg-white">
              <div className="project-agent-chat-header relative flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-[#1f1f1e]">
                  <MessageCircle className="w-4 h-4" />
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
                      <History className="w-4 h-4" />
                    </button>
                    {isHistoryPopoverOpen ? (
                      <div className="project-agent-history-popover absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#e6e6e4] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)]">
                        <div className="px-3 py-3">
                          <p className="text-xs font-semibold text-[#1f1f1e]">History</p>
                          <div className="mt-2 relative">
                            <Search className="w-3.5 h-3.5 text-[#9b9b98] absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              value={historyQuery}
                              onChange={(event) => setHistoryQuery(event.target.value)}
                              placeholder="Search..."
                            className="project-agent-history-search h-9 w-full rounded-xl border border-[#d9d9d7] bg-[#fbfbfa] pl-8 pr-3 text-xs text-[#1f1f1e] placeholder:text-[#a3a3a0] focus:outline-none focus:ring-2 focus:ring-black"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={startNewChat}
                            className="project-agent-toolbar-button mt-2 inline-flex min-h-8 items-center gap-1 rounded-xl border border-[#d9d9d7] bg-white px-2.5 text-xs font-medium text-[#1f1f1e] hover:bg-[#f3f3f2]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            New chat
                          </button>
                        </div>
                        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
                          {isHistoryLoading && historyItems.length === 0 ? (
                            <div className="px-2 py-3 text-xs text-[#787876]">Loading history...</div>
                          ) : filteredHistoryItems.length === 0 ? (
                            <div className="px-2 py-3 text-xs text-[#787876]">No matching conversations.</div>
                          ) : (
                            filteredHistoryItems.map((item) => (
                              <button
                                key={item.sessionId}
                                type="button"
                                onClick={() => selectHistory(item.sessionId)}
                                className={`project-agent-history-item w-full text-left rounded-xl px-2.5 py-2 border transition-colors ${
                                  item.sessionId === sessionId
                                    ? 'project-agent-history-item--active bg-[#f7f7f5] border-[#1f1f1e]'
                                    : 'project-agent-history-item--idle bg-transparent border-transparent hover:bg-[#f7f7f5] hover:border-[#e6e6e4]'
                                }`}
                              >
                                <div className="text-[12px] text-[#1f1f1e] font-medium truncate">{item.title}</div>
                                <div className="text-[10px] text-[#9b9b98] mt-0.5">
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

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
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
                      const isUserMessage = message.role === 'user';
                      const showRetry = isUserMessage && retryableUserMessageId === message.id;
                      return (
                        <div key={message.id} className={isUserMessage ? 'ml-auto w-fit max-w-[94%]' : 'max-w-[94%]'}>
                          <div
                            className={`project-agent-chat-bubble rounded-xl px-4 py-3 text-sm ${
                              isUserMessage
                                ? 'project-agent-chat-bubble--user bg-[#0f0f0f] text-white leading-7'
                                : 'project-agent-chat-bubble--assistant bg-[#efefed] text-[#1f1f1e] leading-6'
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
                                  <code className="project-agent-inline-code rounded bg-black/10 px-1 py-0.5 text-xs">{children}</code>
                                )
                              }}
                            >
                              {messageText}
                            </ReactMarkdown>
                          </div>
                          {showRetry ? (
                            <div className="mt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={handleRetryLatestUserMessage}
                                className="project-agent-toolbar-button inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d9d9d7] bg-white px-3 text-xs font-medium text-[#1f1f1e] hover:bg-[#f3f3f2]"
                                aria-label="Retry this message"
                                title="Retry"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Retry</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {pendingUserText && !hasPendingInMessages ? (
                      <div className="project-agent-chat-bubble project-agent-chat-bubble--user ml-auto w-fit max-w-[94%] rounded-xl bg-[#0f0f0f] px-4 py-3 text-sm leading-7 text-white">
                        {pendingUserText}
                      </div>
                    ) : null}

                    {shouldShowAssistantPlaceholder ? (
                      <div className="project-agent-chat-bubble project-agent-chat-bubble--assistant max-w-[94%] rounded-xl bg-[#efefed] px-4 py-3 text-sm text-[#787876]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={thinkingMessageIndex}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.2 }}
                            >
                              {THINKING_MESSAGES[thinkingMessageIndex]}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      </div>
                    ) : null}
                    <div ref={chatBottomRef} />
                  </motion.div>
                </AnimatePresence>
              </div>

                <div className="project-agent-chat-footer px-4 py-4">
                {!awaitingAssistantTurn && visiblePromptChipSuggestions.chips.length > 0 ? (
                  <div className="project-agent-chip-cloud mb-3 flex flex-wrap items-center gap-2">
                    {visiblePromptChipSuggestions.chips.map((chip) => (
                      <button
                        key={`${visiblePromptChipSuggestions.stageKey}:${chip}`}
                        type="button"
                        onClick={() => handlePromptChipClick(chip)}
                        disabled={!isReady || awaitingAssistantTurn}
                        className="project-agent-chip inline-flex items-center rounded-full border border-[#d7d7d3] bg-[rgba(255,255,255,0.88)] px-3.5 py-2 text-xs font-medium text-[#3f3f3b] backdrop-blur-sm transition hover:border-[#b9b9b4] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                ) : null}
                <form
                  onSubmit={handleSubmit}
                  className="project-agent-chat-input mt-3 flex items-center gap-2 rounded-[26px] border border-[#d9d9d7] bg-white p-2 shadow-[0_18px_40px_rgba(15,15,15,0.06)]"
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={chatInputPlaceholder}
                    className="project-agent-chat-input-field flex-1 min-h-12 rounded-[18px] bg-transparent px-4 text-sm text-[#1f1f1e] placeholder:text-[#9b9b98] focus:outline-none disabled:opacity-50"
                    disabled={!isReady || awaitingAssistantTurn}
                  />
                  <button
                    type="submit"
                    disabled={!isReady || awaitingAssistantTurn || !draft.trim()}
                    aria-label={awaitingAssistantTurn ? 'Waiting for response' : 'Send message'}
                    className={`project-agent-send-button inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200 ease-out disabled:opacity-50 ${
                      awaitingAssistantTurn
                        ? 'bg-[#8d8d8a]'
                        : 'bg-[#0f0f0f] shadow-[0_10px_24px_rgba(15,15,15,0.16)] hover:-translate-y-[1px] hover:scale-[1.03] hover:bg-[#1a1a1a] hover:shadow-[0_16px_32px_rgba(15,15,15,0.2)] active:translate-y-0 active:scale-[0.97] active:bg-black active:shadow-[0_8px_18px_rgba(15,15,15,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1e]/12'
                    }`}
                  >
                    {awaitingAssistantTurn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 translate-x-[0.5px] -translate-y-[0.5px]" />
                    )}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </DashboardContentTransition>

      <VideoAssetDetailsModal
        isOpen={showVideoDetails}
        onClose={() => setShowVideoDetails(false)}
        video={selectedVideo}
        size="compact"
        cloneActionLabel={videoDetailsCloneActionLabel}
        requireFirstFrameForClone
        onUseForClone={(video) => handleSelectVideoFromDetails(video as CloneableVideoAsset)}
      />
      <style jsx>{`
        .avatar-workspace-wave {
          background:
            linear-gradient(
              115deg,
              rgba(255, 255, 255, 0) 20%,
              rgba(255, 255, 255, 0.75) 36%,
              rgba(255, 255, 255, 0.12) 52%,
              rgba(255, 255, 255, 0) 68%
            ),
            linear-gradient(180deg, #efefef 0%, #e7e7e7 52%, #f4f4f4 100%);
          background-size: 220% 100%, 100% 100%;
          animation: avatarWorkspaceWaveSweep 1.7s linear infinite;
        }

        @keyframes avatarWorkspaceWaveSweep {
          0% {
            background-position: 140% 0, 0 0;
          }
          100% {
            background-position: -40% 0, 0 0;
          }
        }
      `}</style>
    </div>
  );
}
