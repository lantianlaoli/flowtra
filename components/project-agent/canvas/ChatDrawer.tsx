'use client';

import { FormEvent } from 'react';
import type { UIMessage } from '@ai-sdk/react';

type HistoryItem = {
  sessionId: string;
  title: string;
  updatedAt: string;
};

type ChatDrawerProps = {
  open: boolean;
  historyItems: HistoryItem[];
  activeSessionId: string;
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  draft: string;
  statusNote: string;
  onToggle: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onSelectHistory: (sessionId: string) => void;
  onStartNewSession: () => void;
};

const getMessageText = (message: UIMessage) => {
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
};

export default function ChatDrawer({
  open,
  historyItems,
  activeSessionId,
  messages,
  status,
  draft,
  statusNote,
  onToggle,
  onDraftChange,
  onSubmit,
  onSelectHistory,
  onStartNewSession,
}: ChatDrawerProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <aside
      className={`flex h-full flex-col rounded-[28px] border border-[#e7e3d7] bg-white/92 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all ${
        open ? 'w-[360px] min-w-[360px]' : 'w-[72px] min-w-[72px]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#f0ede5] px-4 py-4">
        {open ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b7b75]">Agent</p>
            <h2 className="text-base font-semibold text-black">Canvas Chat</h2>
          </div>
        ) : null}
        <button
          className="rounded-full border border-[#ddd8cc] bg-[#f8f7f2] px-3 py-2 text-xs font-semibold text-black"
          onClick={onToggle}
          type="button"
        >
          {open ? 'Hide' : 'Chat'}
        </button>
      </div>

      {open ? (
        <>
          <div className="border-b border-[#f0ede5] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7c7c76]">Sessions</p>
              <button
                className="rounded-full border border-[#ddd8cc] px-3 py-1.5 text-xs font-medium text-black"
                onClick={onStartNewSession}
                type="button"
              >
                New
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {historyItems.slice(0, 6).map((item) => (
                <button
                  className={`rounded-[18px] border px-3 py-2.5 text-left ${
                    item.sessionId === activeSessionId
                      ? 'border-black bg-black text-white'
                      : 'border-[#ebe6da] bg-white text-black'
                  }`}
                  key={item.sessionId}
                  onClick={() => onSelectHistory(item.sessionId)}
                  type="button"
                >
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className={`mt-1 text-[11px] ${item.sessionId === activeSessionId ? 'text-white/75' : 'text-[#7b7b75]'}`}>
                    {new Date(item.updatedAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#ddd8cc] bg-[#faf8f3] px-4 py-5 text-sm leading-6 text-[#6c6c66]">
                Ask the agent to add or connect nodes. Example: `Add an Avatar Ads node and connect the current avatar and product.`
              </div>
            ) : null}

            {messages.map((message) => {
              const text = getMessageText(message);
              if (!text) return null;
              const isUser = message.role === 'user';
              return (
                <div
                  className={`rounded-[18px] px-4 py-3 text-sm leading-6 ${
                    isUser ? 'ml-10 bg-black text-white' : 'mr-10 border border-[#eee9de] bg-[#faf8f3] text-black'
                  }`}
                  key={message.id}
                >
                  {text}
                </div>
              );
            })}
          </div>

          <form className="border-t border-[#f0ede5] px-4 py-4" onSubmit={(e) => e.preventDefault()}>
            {statusNote ? (
              <p className="mb-3 rounded-2xl bg-[#f4f1e8] px-3 py-2 text-xs text-[#66665f]">{statusNote}</p>
            ) : null}
            {/* Under construction — chat agent coming soon */}
            <div className="relative min-h-[88px] w-full overflow-hidden rounded-[20px] border border-dashed border-[#d4cfbf] bg-[#faf9f5]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 py-3">
                <span className="text-lg">🚧</span>
                <p className="text-center text-xs font-medium text-[#9b9890]">Chat agent coming soon</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <button
                className="rounded-full bg-[#d1cec3] px-4 py-2 text-sm font-semibold text-white cursor-not-allowed"
                disabled
                type="button"
              >
                Send
              </button>
            </div>
          </form>
        </>
      ) : null}
    </aside>
  );
}
