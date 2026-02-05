'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DefaultChatTransport } from 'ai';
import { useChat, type UIMessage } from '@ai-sdk/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowUp, Loader2, MessageCircle, Plus } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import { useCredits } from '@/contexts/CreditsContext';
import { createClient } from '@/lib/supabase/client';

interface SessionState {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';
  step?: string;
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

  return {
    id: raw.id ?? `session-${index}`,
    role: raw.role ?? 'assistant',
    parts
  };
};

export default function ProjectAgentPage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();

  const [sessionId, setSessionId] = useState('');
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [draft, setDraft] = useState('');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [typedAssistantTexts, setTypedAssistantTexts] = useState<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, number>>({});
  const typedAssistantTextsRef = useRef<Record<string, string>>({});

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

  useEffect(() => {
    typedAssistantTextsRef.current = typedAssistantTexts;
  }, [typedAssistantTexts]);

  useEffect(() => {
    // Typewriter-style progressive rendering for assistant messages.
    messages.forEach((message) => {
      if (message.role !== 'assistant') return;
      const targetText = renderUIMessageText(message);
      if (!targetText) return;

      const currentText = typedAssistantTextsRef.current[message.id] ?? '';
      if (currentText === targetText) return;

      const existingTimer = typingTimersRef.current[message.id];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      if (!targetText.startsWith(currentText)) {
        setTypedAssistantTexts((prev) => ({ ...prev, [message.id]: targetText }));
        return;
      }

      const tick = (fromLength: number) => {
        if (fromLength >= targetText.length) return;
        const step = Math.max(1, Math.ceil((targetText.length - fromLength) / 18));
        const nextLength = Math.min(targetText.length, fromLength + step);
        const nextText = targetText.slice(0, nextLength);
        setTypedAssistantTexts((prev) => ({ ...prev, [message.id]: nextText }));

        if (nextLength < targetText.length) {
          typingTimersRef.current[message.id] = window.setTimeout(() => tick(nextLength), 14);
        }
      };

      typingTimersRef.current[message.id] = window.setTimeout(() => tick(currentText.length), 14);
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      Object.values(typingTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

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

      if (!isStreaming && Array.isArray(payload.session.messages)) {
        const normalizedMessages = payload.session.messages.map((message: unknown, index: number) =>
          normalizeStoredMessage(message, index)
        );
        setMessages(normalizedMessages);
      }
    } catch (fetchError) {
      console.error('Failed to load agent session:', fetchError);
    }
  }, [isStreaming, sessionId, setMessages]);

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
    sendMessage({ text: next });
    setDraft('');
  }, [clearError, draft, ensureHistoryTracked, isStreaming, sendMessage, sessionId]);

  const startNewChat = useCallback(() => {
    const nextId = createSessionId();
    setSessionId(nextId);
    setSessionState(null);
    setDraft('');
    setStatusNote('');
    setMessages([]);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
    }
    ensureHistoryTracked(nextId, { prependIfNew: true });
    void refreshHistory();
  }, [ensureHistoryTracked, refreshHistory, setMessages]);

  const selectHistory = useCallback((targetSessionId: string) => {
    setSessionId(targetSessionId);
    setSessionState(null);
    setStatusNote('');
    setMessages([]);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, targetSessionId);
    }
    ensureHistoryTracked(targetSessionId);
  }, [ensureHistoryTracked, setMessages]);

  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  const isReady = Boolean(sessionId);

  return (
    <div className="h-screen overflow-hidden bg-[#f7f7f5]">
      <Sidebar
        credits={credits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 h-screen overflow-hidden">
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
                    {messages.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f3f3f2] p-4 text-sm text-[#787876]">
                        Tell Flowtra what you want to create, and it will guide you workflow by workflow.
                      </div>
                    )}

                    {messages.map((message) => {
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
                          {message.role === 'assistant'
                            ? (typedAssistantTexts[message.id] ?? messageText)
                            : messageText}
                        </ReactMarkdown>
                      </div>
                    );})}

                    {isStreaming && (
                      <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm bg-[#efefed] text-[#787876]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Flowtra is thinking...</span>
                        </div>
                      </div>
                    )}
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
    </div>
  );
}
