'use client';

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Kling } from '@lobehub/icons';
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, Clapperboard, History, Loader2, Lock, MessageCircle, Package, Plus, RefreshCw, Search, Sparkles, User } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import VideoAssetCard from '@/components/VideoAssetCard';
import VideoAssetDetailsModal from '@/components/VideoAssetDetailsModal';
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
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import { getVideoModelDisplayName, type VideoModel } from '@/lib/constants';
import {
  getPrimaryCloneSelection,
  hasExplicitCloneAvatarSelectionState,
  hasExplicitCloneProductSelectionState,
  normalizeCloneSelections
} from '@/lib/project-agent/clone-selection';
import {
  getProjectAgentVideoModels,
  normalizeProjectAgentVideoModel,
} from '@/lib/project-agent/video-model';
import { getProjectAgentPromptChips } from '@/lib/project-agent/prompt-chips';
import { serializeProjectAgentCloneShot } from '@/lib/project-agent/clone-prompt-schema';
import {
  resolveProjectAgentCloneMergedVideoUrl,
  shouldShowProjectAgentCloneMergedReview,
} from '@/lib/project-agent/clone-execution';
import { isStartVideoGenerationCommand } from '@/lib/project-agent/clone-workflow-control';
import {
  isCloneFlowEffectivelyFinished,
  isNextCloneIntentMessage
} from '@/lib/project-agent/next-clone-intent';
import { buildWorkspaceScenes } from '@/lib/project-agent/workspace-scenes';
import { analysisToLegacyFlatShots } from '@/lib/video-analysis-schema';

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
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
    model?: VideoModel;
    duration?: string;
    creditsCost?: number;
    error?: string | null;
    mergedVideoUrl?: string | null;
    segments?: CloneExecutionSegment[];
  } | null;
  avatar?: { id: string; name: string; photoUrl: string } | null;
  product?: { id: string; name: string } | null;
  language?: string;
  videoDurationSeconds?: number;
  videoAspectRatio?: '16:9' | '9:16';
  videoModel?: VideoModel;
  projectId?: string;
  generatedPrompts?: Record<string, unknown> | null;
  imagePrompt?: string | null;
  generatedImageUrl?: string | null;
}

const hasCloneModelLockState = (state: SessionState | null | undefined) => (
  state?.intent === 'competitor_ugc_replication' ||
  Boolean(state?.cloneReferenceVideo?.id) ||
  Boolean(state?.cloneExecution?.projectId) ||
  (state?.cloneReplacementDraft?.status != null && state.cloneReplacementDraft.status !== 'idle')
);

const resolveProjectAgentModelIntent = (
  state: SessionState | null | undefined,
  forceCloneContext = false
): SessionState['intent'] => (
  forceCloneContext || hasCloneModelLockState(state)
    ? 'competitor_ugc_replication'
    : state?.intent
);

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
};

type CloneAvatarSelection = NonNullable<ClonePromptDraft['selectedAvatar']>;
type CloneProductSelection = NonNullable<ClonePromptDraft['selectedProduct']>;

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

const inferReferenceStructure = (analysis: Record<string, unknown> | null | undefined) => {
  const compact = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const sanitize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const pickFirst = (source: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const candidate = compact(source[key]);
      if (candidate) return candidate;
    }
    return '';
  };

  if (!analysis || typeof analysis !== 'object') {
    return {
      summary: 'Reference video selected, but detailed structure analysis is unavailable.',
      keyShots: [] as string[],
      detectedCharacter: 'no clear character detected',
      detectedProduct: 'no clear product detected'
    };
  }

  const normalizedShots = analysisToLegacyFlatShots(analysis).map((shot, index) => {
    const shotRecord = shot as unknown as Record<string, unknown>;
    const subject = pickFirst(shotRecord, ['subject', 'main_subject', 'character', 'person', 'actor']);
    const action = pickFirst(shotRecord, ['action', 'movement', 'shot_action']);
    const context = pickFirst(shotRecord, ['context_environment', 'environment', 'background', 'setting']);
    const description = pickFirst(shotRecord, ['shot_description', 'description', 'summary', 'first_frame_description']);
    const start = pickFirst(shotRecord, ['start_time', 'start', 'time_start']);
    const end = pickFirst(shotRecord, ['end_time', 'end', 'time_end']);

    const core = sanitize(description || [subject, action, context].filter(Boolean).join(', '));
    const timeRange = (start || end) ? `${start || '??'}-${end || '??'}` : '';

    return {
      shotIndex: index + 1,
      core,
      subject,
      action,
      context,
      timeRange
    };
  });

  const keyShots = normalizedShots
    .map((_, index) => normalizedShots[index])
    .filter((shot) => Boolean(shot.core))
    .slice(0, 4)
    .map((shot) => {
      const timeSuffix = shot.timeRange ? ` (${shot.timeRange})` : '';
      return `Shot ${shot.shotIndex}${timeSuffix}: ${shot.core}`;
    })
    .filter(Boolean);

  const allText = JSON.stringify(analysis).toLowerCase().replace(/\s+/g, ' ');
  const findByKeywords = (keywords: string[]) => keywords.find((keyword) => allText.includes(keyword)) || null;
  const detectedCharacter =
    findByKeywords(['baby']) ||
    findByKeywords(['mother']) ||
    findByKeywords(['woman']) ||
    findByKeywords(['female']) ||
    findByKeywords(['man']) ||
    findByKeywords(['male']) ||
    findByKeywords(['person']) ||
    findByKeywords(['child']) ||
    'no clear character detected';

  const detectedProduct =
    findByKeywords(['phone stand']) ||
    findByKeywords(['tripod']) ||
    findByKeywords(['stroller']) ||
    findByKeywords(['toy']) ||
    findByKeywords(['bottle']) ||
    findByKeywords(['device']) ||
    findByKeywords(['book']) ||
    (allText.includes('product') ? 'product (unspecified)' : null) ||
    'no clear product detected';

  const parsedDuration = (analysis as { video_duration_seconds?: unknown }).video_duration_seconds;
  const durationLabel = typeof parsedDuration === 'number' && Number.isFinite(parsedDuration)
    ? `${parsedDuration}s`
    : 'unknown duration';

  const summary =
    keyShots.length > 0
      ? `Parsed ${normalizedShots.length || keyShots.length} shots (${durationLabel}). Main on-screen subject appears to be ${detectedCharacter}; product/object signal: ${detectedProduct}.`
      : `Reference selected (${durationLabel}), but shot-level details are limited. Detected subject: ${detectedCharacter}; product/object signal: ${detectedProduct}.`;

  return { summary, keyShots, detectedCharacter, detectedProduct };
};

const normalizeVideoModel = (
  raw: unknown,
  intent?: SessionState['intent']
): VideoModel => {
  return normalizeProjectAgentVideoModel(raw, 'kling_3', intent);
};

const PROJECT_AGENT_MODEL_META: {
  description: string;
  icon: ComponentType<{ className?: string }>;
} = {
  description: 'Kling std mode',
  icon: Kling
};

function ProjectAgentModelSelector({
  selectedModel,
  intent,
  onModelChange
}: {
  selectedModel: VideoModel;
  intent?: SessionState['intent'];
  onModelChange: (model: VideoModel) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelOptions = useMemo(() => getProjectAgentVideoModels(intent), [intent]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const selectedMeta = PROJECT_AGENT_MODEL_META;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-12 items-center gap-2 rounded-[22px] border border-[#d9d9d7] bg-white px-3.5 text-sm font-medium text-[#1f1f1e] shadow-[0_1px_0_rgba(15,15,15,0.03)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#c9c9c5] hover:bg-[#fdfdfc] hover:shadow-[0_10px_24px_rgba(15,15,15,0.08)] active:translate-y-0 active:scale-[0.985] active:shadow-[0_4px_12px_rgba(15,15,15,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1e]/10"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e6e4] bg-[#fcfcfb]">
          <selectedMeta.icon className="h-[18px] w-[18px] text-[#1f1f1e]" />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span>{getVideoModelDisplayName(selectedModel)}</span>
        </span>
        <ChevronDown className={`ml-1 h-3.5 w-3.5 text-[#6f6f6d] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-full left-0 z-20 mb-2 w-[300px] rounded-[24px] border border-[#e6e6e4] bg-white p-2 shadow-[0_24px_60px_rgba(15,15,15,0.12)]"
            role="listbox"
            aria-label="Video model"
          >
            {modelOptions.map((modelOption) => {
              const isSelected = modelOption === selectedModel;

              return (
                <button
                  key={modelOption}
                  type="button"
                  onClick={() => {
                    onModelChange(modelOption);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[20px] border px-3 py-3 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1e]/8 ${
                    isSelected
                      ? 'border-[#d9d9d7] bg-[#fcfcfb] text-[#1f1f1e]'
                      : 'border-transparent text-[#1f1f1e] hover:-translate-y-[1px] hover:border-[#e7e7e4] hover:bg-[#fcfcfb] hover:shadow-[0_8px_18px_rgba(15,15,15,0.06)] active:translate-y-0 active:scale-[0.99]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e6e6e4] bg-white">
                      <PROJECT_AGENT_MODEL_META.icon className="h-[18px] w-[18px] text-current" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{getVideoModelDisplayName(modelOption)}</span>
                    </span>
                  </span>
                  <span className="ml-3 inline-flex h-5 w-5 items-center justify-center">
                    {isSelected ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#0f0f0f] bg-[#0f0f0f] text-white shadow-[0_6px_14px_rgba(15,15,15,0.12)]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

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
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const supabase = useSupabaseBrowserClient();

  const [sessionId, setSessionId] = useState('');
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [selectedVideoModel, setSelectedVideoModel] = useState<VideoModel>('kling_3');
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
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const historyPopoverRef = useRef<HTMLDivElement | null>(null);
  const isStreamingRef = useRef(false);
  const lastPersistedMessagesSignatureRef = useRef('');
  const draftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalCloneDraftEditAtRef = useRef(0);
  const pendingCloneSelectionPersistRef = useRef<Promise<void> | null>(null);
  const latestCloneDraftRef = useRef<ClonePromptDraft | null>(null);
  const latestSessionStateRef = useRef<SessionState | null>(null);
  const pendingCloneDraftPersistRef = useRef<Promise<void> | null>(null);
  const lastLocalVideoModelEditAtRef = useRef(0);
  const pendingVideoModelPersistRef = useRef<Promise<void> | null>(null);
  const latestSelectedVideoModelRef = useRef<VideoModel>('kling_3');
  const prevAvatarStepRef = useRef<string | null>(null);
  const prevClonePhaseRef = useRef<SessionState['cloneExecution'] extends { phase: infer P } ? P : string | null>(null);
  const notificationPermissionRequestedRef = useRef(false);
  const isCloneModelLockedContext = Boolean(
    showCloneableVideos ||
    showCloneReplacementSelectors ||
    awaitingCloneEntryReply ||
    awaitingCloneStructureReply ||
    awaitingCloneDraftReply ||
    hasCloneModelLockState(sessionState)
  );
  const modelSelectorIntent = resolveProjectAgentModelIntent(sessionState, isCloneModelLockedContext);

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
      prepareSendMessagesRequest: ({ id, messages }) => {
        const latestSessionState = latestSessionStateRef.current ?? sessionState;
        const draftSelection = latestCloneDraftRef.current ?? latestSessionState?.cloneReplacementDraft;
        const statePatch: Record<string, unknown> = {};
        statePatch.videoModel = normalizeProjectAgentVideoModel(
          selectedVideoModel,
          'kling_3',
          modelSelectorIntent
        );
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
  }, [messages, resetLocalCloneSurfaceForNextReference, sendMessage, sessionState?.cloneExecution?.mergedVideoUrl, sessionState?.cloneExecution?.phase]);

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

  const persistVideoModel = useCallback(async (model: VideoModel) => {
    if (!sessionId) return;
    const normalizedModel = normalizeProjectAgentVideoModel(
      model,
      'kling_3',
      modelSelectorIntent
    );
    const persistTask = (async () => {
      try {
        const response = await fetch('/api/project-agent/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            statePatch: {
              videoModel: normalizedModel
            }
          })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to save video model.');
        }
      } catch (modelPersistError) {
        console.error('Failed to persist video model:', modelPersistError);
        setStatusNote('Failed to save the selected video model. Please try again.');
      }
    })();

    pendingVideoModelPersistRef.current = persistTask;
    try {
      await persistTask;
    } finally {
      if (pendingVideoModelPersistRef.current === persistTask) {
        pendingVideoModelPersistRef.current = null;
      }
    }
  }, [modelSelectorIntent, sessionId]);


  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/project-agent/session?sessionId=${sessionId}`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) {
          setSessionState(null);
          setSelectedVideoModel('kling_3');
        }
        return;
      }

      const payload = await response.json();
      if (!payload?.session) return;
      const incomingState = payload.session.state || null;
      const incomingModelIntent = resolveProjectAgentModelIntent(incomingState);
      const incomingVideoModel = normalizeProjectAgentVideoModel(
        incomingState?.videoModel,
        'kling_3',
        incomingModelIntent
      );
      const hasVeryRecentLocalVideoModelEdit = Date.now() - lastLocalVideoModelEditAtRef.current < 5000;
      const hasPendingVideoModelPersist = Boolean(pendingVideoModelPersistRef.current);
      const shouldPreserveLocalVideoModel = (
        latestSelectedVideoModelRef.current !== incomingVideoModel &&
        (hasVeryRecentLocalVideoModelEdit || hasPendingVideoModelPersist)
      );

      if (!shouldPreserveLocalVideoModel) {
        setSelectedVideoModel(incomingVideoModel);
      }

      setSessionState((prev) => {
        if (!incomingState) return null;
        if (!prev) {
          return {
            ...incomingState,
            videoModel: incomingVideoModel
          };
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
              videoModel: incomingVideoModel,
              cloneExecution: prev.cloneExecution
            }
          : {
              ...incomingState,
              videoModel: incomingVideoModel,
              cloneExecution: mergeCloneExecutionWithLocal(prev.cloneExecution, incomingState.cloneExecution) ?? incomingState.cloneExecution
            };

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
    if (!sessionId) return;
    void fetchSession();
    void refreshHistory();
  }, [sessionId, fetchSession, refreshHistory]);

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
    prevAvatarStepRef.current = null;
    prevClonePhaseRef.current = null;
    notificationPermissionRequestedRef.current = false;
  }, [sessionId]);

  const handleVideoModelChange = useCallback((model: VideoModel) => {
    const normalizedModel = normalizeProjectAgentVideoModel(
      model,
      'kling_3',
      modelSelectorIntent
    );
    setStatusNote('');
    lastLocalVideoModelEditAtRef.current = Date.now();
    setSelectedVideoModel(normalizedModel);
    setSessionState((prev) => (
      prev
        ? {
            ...prev,
            videoModel: normalizedModel
          }
        : prev
    ));
    void persistVideoModel(normalizedModel);
  }, [modelSelectorIntent, persistVideoModel]);

  useEffect(() => {
    latestSelectedVideoModelRef.current = selectedVideoModel;
  }, [selectedVideoModel]);

  useEffect(() => {
    const normalizedModel = normalizeProjectAgentVideoModel(
      selectedVideoModel,
      'kling_3',
      modelSelectorIntent
    );
    if (normalizedModel === selectedVideoModel) return;

    lastLocalVideoModelEditAtRef.current = Date.now();
    setSelectedVideoModel(normalizedModel);
    setSessionState((prev) => (
      prev
        ? {
            ...prev,
            videoModel: normalizedModel
          }
        : prev
    ));
    void persistVideoModel(normalizedModel);
  }, [modelSelectorIntent, persistVideoModel, selectedVideoModel]);

  useEffect(() => {
    const nextStep = sessionState?.step ?? null;
    if (!nextStep) return;

    const previousStep = prevAvatarStepRef.current;
    if (previousStep === nextStep) return;

    if (nextStep === 'generating_image') {
      sendBrowserNotification({
        title: 'Image generation started',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-image-start'
      });
    } else if (nextStep === 'generating_videos') {
      sendBrowserNotification({
        title: 'Video generation started',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-video-start'
      });
    } else if (nextStep === 'completed') {
      sendBrowserNotification({
        title: 'Your video is ready',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-completed'
      });
    } else if (nextStep === 'failed') {
      sendBrowserNotification({
        title: 'Generation failed',
        body: 'Flowgen: Avatar Ads',
        tag: 'agent-avatar-failed'
      });
    }

    prevAvatarStepRef.current = nextStep;
  }, [sessionState?.step]);

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
    if (!sessionState?.projectId) return;

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
    const structure = inferReferenceStructure(video.analysis_result);
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

    setSessionState((prev) => ({
      ...(prev ?? {}),
      ...referencePatch
    }));
    setSelectedVideoModel('kling_3');
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
      return;
    }

    const referenceSelectionMessage = `I selected "${referenceName}" as the reference video for clone.`;
    try {
      setPendingUserText(referenceSelectionMessage);
      setPendingBaselineCount(messages.length);

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
    setSessionId(nextId);
    setSessionState(null);
    setSelectedVideoModel('kling_3');
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

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
    }
    ensureHistoryTracked(nextId, { prependIfNew: true });
    void refreshHistory();
  }, [ensureHistoryTracked, refreshHistory, setMessages]);

  const selectHistory = useCallback((targetSessionId: string) => {
    setSessionId(targetSessionId);
    setSessionState(null);
    setSelectedVideoModel('kling_3');
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

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, targetSessionId);
    }
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

  const handleQuickStart = useCallback(async (action: 'clone' | 'motion_swap' | 'avatar_ads') => {
    if (action === 'motion_swap') {
      router.push('/dashboard/motion-swap');
      return;
    }

    if (action === 'avatar_ads') {
      router.push('/dashboard/avatar-ads');
      return;
    }

    if (!sessionId || sendLocked) return;

    clearError();
    setStatusNote('');
    ensureHistoryTracked(sessionId);

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
    messages,
    router,
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
      : null
  }), [
    sessionState,
    showCloneSceneWorkspaceStep,
    showCloneReplacementSelectors,
    showCloneableVideos
  ]);
  const [visiblePromptChipSuggestions, setVisiblePromptChipSuggestions] = useState(computedPromptChipSuggestions);

  useEffect(() => {
    const needsMentionOptions =
      showCloneReplacementSelectors ||
      showCloneSceneWorkspaceStep;
    if (!needsMentionOptions) return;
    if (cloneAvatarOptions.length === 0 || cloneProductOptions.length === 0) {
      void loadCloneReplacementOptions();
    }
  }, [
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
    if (hasPendingInMessages) {
      setPendingUserText(null);
      setPendingBaselineCount(0);
    }
  }, [hasPendingInMessages, pendingUserText]);

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

  const hasCloneSurfaceContent = showCloneableVideos || showCloneReplacementSelectors || showCloneSceneWorkspaceStep;
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
  const shouldHoldLeftSurfaceForAssistantReply = isCloneFlowContext && hasUnansweredUserTurn && awaitingAssistantTurn;
  const showLeftSurfaceContent = hasCloneSurfaceContent && !shouldHoldLeftSurfaceForAssistantReply;
  const isWorkflowSurfacePending = !hasCloneSurfaceContent && isCloneFlowContext && (
    isStreaming ||
    awaitingCloneEntryReply ||
    awaitingCloneStructureReply ||
    awaitingCloneDraftReply ||
    waitingForCloneStructureGate ||
    isCloneDraftGenerating
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

  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f7f7f5]">
      <Sidebar
        credits={credits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="dashboard-content-offset h-[100dvh] overflow-hidden min-h-0">
        <div className="h-full box-border min-h-0 p-4 md:p-6 lg:p-8">
          <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)] gap-4">
            <section className="relative h-full min-h-0 rounded-xl border border-[#e6e6e4] bg-[#fbfbfa] overflow-hidden">
              <div className={showLeftSurfaceContent ? 'h-full overflow-y-auto px-4 py-4 md:px-6 md:py-5' : 'h-full grid place-items-center px-6'}>
                {showLeftSurfaceContent ? (
                  <div className="w-full min-h-full space-y-4">
                    {showCloneableVideos && (
                    <div className="w-full rounded-xl border border-[#e6e6e4] bg-white p-4">
                      <div className="mb-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f1f1e]">Step 1: Choose Reference Video</p>
                          <p className="text-xs text-[#787876]">Select one video from Assets first. Product selection comes later.</p>
                        </div>
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

                    {showCloneReplacementSelectors && !showCloneSceneWorkspaceStep && (
                    <div className="relative isolate w-full rounded-xl border border-[#e6e6e4] bg-white p-4 space-y-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 2</p>
                        <p className="text-sm font-medium text-[#4f4f4d]">Choose replacement avatar and/or product</p>
                        <p className="mt-1 text-xs text-[#787876]">Pick the parts you want to replace. You can continue with an avatar, a product, or both.</p>
                      </div>

                      {sessionState?.cloneReplacementDraft?.status === 'failed' && sessionState.cloneReplacementDraft.error ? (
                        <div className="rounded-xl border border-[#ead2cf] bg-[#fff7f5] px-4 py-3 text-xs text-[#8a4d45]">
                          Draft prep failed: {sessionState.cloneReplacementDraft.error}
                        </div>
                      ) : null}

                      {isCloneOptionsLoading ? (
                        <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-6 text-center text-xs text-[#787876]">
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
                                  className={`relative z-10 pointer-events-auto rounded-xl p-1.5 text-left transition-colors ${selectedCloneAvatarIds.includes(avatar.id) ? 'border-2 border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.04)]' : 'border border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                >
                                  <div className="w-full aspect-square rounded-[10px] overflow-hidden bg-[#efefed] mb-1">
                                    {avatar.photoUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={avatar.photoUrl} alt={avatar.name} className="w-full h-full object-cover" />
                                    ) : null}
                                  </div>
                                  <span
                                    className={`inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-medium ${selectedCloneAvatarIds.includes(avatar.id) ? 'bg-[#0f0f0f] text-white' : 'bg-[#f3f3f2] text-[#1f1f1e]'}`}
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
                              <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-5 text-center text-xs text-[#787876]">
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
                                      className={`relative z-10 pointer-events-auto rounded-xl p-1.5 text-left transition-colors ${selectedCloneProductIds.includes(product.id) ? 'border-2 border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.04)]' : 'border border-[#e6e6e4] bg-white hover:bg-[#f9f9f8]'}`}
                                    >
                                      <div className="w-full aspect-square rounded-[10px] overflow-hidden bg-[#efefed] mb-1">
                                        {product.photoUrl ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                                        ) : null}
                                      </div>
                                      <span
                                        className={`inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-medium ${selectedCloneProductIds.includes(product.id) ? 'bg-[#0f0f0f] text-white' : 'bg-[#f3f3f2] text-[#1f1f1e]'}`}
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

                    {showCloneSceneWorkspaceStep && !showCloneMergedResultStep ? (
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

                    {showCloneMergedResultStep && sessionState?.cloneExecution ? (
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
                        <div className="mx-auto mt-5 w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#e6e6e4] bg-white">
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

                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          {[
                            {
                              text: 'Clone Viral Video',
                              icon: Clapperboard,
                              action: 'clone' as const
                            },
                            {
                              text: 'Motion Swap (Replace Model)',
                              icon: RefreshCw,
                              action: 'motion_swap' as const
                            },
                            {
                              text: 'Avatar Ads (Spokesperson Video)',
                              icon: User,
                              action: 'avatar_ads' as const
                            }
                          ].map((hint) => (
                            <button
                              key={hint.text}
                              type="button"
                              onClick={() => handleQuickStart(hint.action)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#e4e4e2] bg-white px-3 py-1.5 text-xs text-[#5f5f5d] hover:bg-[#f3f3f2]"
                            >
                              <hint.icon className="h-3.5 w-3.5 text-[#7a7a77]" />
                              <span>{hint.text}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <section className="flowgen-chat-font h-full min-h-0 rounded-xl border border-[#e6e6e4] bg-[#fbfbfa] flex flex-col">
              <div className="relative flex items-center justify-between px-4 py-3 border-b border-[#e6e6e4]">
                <div className="flex min-w-0 items-center gap-2 text-[#1f1f1e]">
                  <MessageCircle className="w-4 h-4" />
                  <span className="truncate whitespace-nowrap text-sm font-semibold">{activeChatTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div ref={historyPopoverRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsHistoryPopoverOpen((prev) => !prev)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d9d9d7] bg-white text-[#1f1f1e] hover:bg-[#f3f3f2]"
                      aria-label="Open history"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    {isHistoryPopoverOpen ? (
                      <div className="absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#e6e6e4] bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)]">
                        <div className="px-3 py-3 border-b border-[#efefed]">
                          <p className="text-xs font-semibold text-[#1f1f1e]">History</p>
                          <div className="mt-2 relative">
                            <Search className="w-3.5 h-3.5 text-[#9b9b98] absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              value={historyQuery}
                              onChange={(event) => setHistoryQuery(event.target.value)}
                              placeholder="Search..."
                              className="h-9 w-full rounded-xl border border-[#d9d9d7] bg-[#fbfbfa] pl-8 pr-3 text-xs text-[#1f1f1e] placeholder:text-[#a3a3a0] focus:outline-none focus:ring-2 focus:ring-black"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={startNewChat}
                            className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-xl border border-[#d9d9d7] bg-white px-2.5 text-xs font-medium text-[#1f1f1e] hover:bg-[#f3f3f2]"
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
                                className={`w-full text-left rounded-xl px-2.5 py-2 border transition-colors ${
                                  item.sessionId === sessionId
                                    ? 'bg-[#f7f7f5] border-[#1f1f1e]'
                                    : 'bg-transparent border-transparent hover:bg-[#f7f7f5] hover:border-[#e6e6e4]'
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
                <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 inline-flex items-start gap-2">
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
                            className={`rounded-xl px-4 py-3 text-sm ${
                              isUserMessage
                                ? 'bg-[#0f0f0f] text-white leading-7'
                                : 'bg-[#efefed] text-[#1f1f1e] leading-6'
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
                          {showRetry ? (
                            <div className="mt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={handleRetryLatestUserMessage}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d9d9d7] bg-white px-3 text-xs font-medium text-[#1f1f1e] hover:bg-[#f3f3f2]"
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
                      <div className="w-fit max-w-[94%] rounded-xl px-4 py-3 text-sm leading-7 ml-auto bg-[#0f0f0f] text-white">
                        {pendingUserText}
                      </div>
                    ) : null}

                    {shouldShowAssistantPlaceholder ? (
                      <div className="max-w-[94%] rounded-xl px-4 py-3 text-sm bg-[#efefed] text-[#787876]">
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

              <div className="border-t border-[#e6e6e4] px-4 py-4">
                {!awaitingAssistantTurn && visiblePromptChipSuggestions.chips.length > 0 ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {visiblePromptChipSuggestions.chips.map((chip) => (
                      <button
                        key={`${visiblePromptChipSuggestions.stageKey}:${chip}`}
                        type="button"
                        onClick={() => handlePromptChipClick(chip)}
                        disabled={!isReady || awaitingAssistantTurn}
                        className="inline-flex items-center rounded-full border border-[#d9d9d7] bg-[#f7f7f5] px-3 py-1.5 text-xs font-medium text-[#4c4c49] transition hover:border-[#bfbfbb] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <ProjectAgentModelSelector
                    selectedModel={selectedVideoModel}
                    intent={modelSelectorIntent}
                    onModelChange={handleVideoModelChange}
                  />
                </div>
                <form
                  onSubmit={handleSubmit}
                  className="mt-3 flex items-center gap-2 rounded-[26px] border border-[#d9d9d7] bg-white p-2 shadow-[0_18px_40px_rgba(15,15,15,0.06)]"
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask Flowgen what to make viral next..."
                    className="flex-1 min-h-12 rounded-[18px] bg-transparent px-4 text-sm text-[#1f1f1e] placeholder:text-[#9b9b98] focus:outline-none disabled:opacity-50"
                    disabled={!isReady || awaitingAssistantTurn}
                  />
                  <button
                    type="submit"
                    disabled={!isReady || awaitingAssistantTurn || !draft.trim()}
                    aria-label={awaitingAssistantTurn ? 'Waiting for response' : 'Send message'}
                    className={`h-12 w-12 shrink-0 rounded-full text-white inline-flex items-center justify-center transition-all duration-200 ease-out disabled:opacity-50 ${
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
