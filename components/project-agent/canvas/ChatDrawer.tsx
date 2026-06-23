'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import Image from 'next/image';
import { ChevronDown, Maximize2, MessageCircle, Minimize2, PackagePlus, Plus, Send, UserPlus, Video } from 'lucide-react';
import { getProjectAgentVisibleMessageText } from '@/lib/project-agent/message-parts';

type PromptTemplateItem = {
  id: string;
  label: string;
  text: string;
};

type ChatDrawerProps = {
  open: boolean;
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  draft: string;
  statusNote: string;
  onToggle: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  promptTemplates?: PromptTemplateItem[];
  onUseTemplate?: (text: string) => void;
  onAssetCreateRequest?: (assetType: 'avatar' | 'product' | 'video') => void;
};

const getMessageText = (message: UIMessage) => {
  return getProjectAgentVisibleMessageText(message).trim();
};

export default function ChatDrawer({
  open,
  messages,
  status,
  draft,
  statusNote,
  onToggle,
  onDraftChange,
  onSubmit,
  promptTemplates = [],
  onUseTemplate,
  onAssetCreateRequest,
}: ChatDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const isBusy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isBusy || !draft.trim()) return;
    onSubmit();
  };

  const handleAssetCreateRequest = (assetType: 'avatar' | 'product' | 'video') => {
    setAssetMenuOpen(false);
    onAssetCreateRequest?.(assetType);
  };

  return (
    <aside
      className={`flex flex-col overflow-hidden text-black transition-[width,height,transform,opacity] duration-200 ease-out ${
        open
          ? 'h-[min(600px,calc(100dvh-6.5rem))] w-[min(400px,calc(100vw-1.5rem))] rounded-[18px] border border-[#dfdfdf] bg-white/95 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-xl'
          : 'h-11 w-[112px] rounded-full'
      }`}
      aria-label="Agent chat"
    >
      <div className={`flex items-center justify-between ${open ? 'border-b border-[#eeeeee] px-4 py-3' : 'h-full'}`}>
        {open ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#eeeeee] bg-white">
              <Image
                src="/logo.svg"
                alt="Flowtra"
                width={20}
                height={20}
                className="logo-theme h-5 w-5"
              />
            </span>
            <h2 className="text-sm font-semibold leading-5 text-black">Agent</h2>
          </div>
        ) : null}
        <button
          className={`project-agent-press-button inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#dedede] bg-white px-3 text-xs font-semibold text-black transition-colors hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${
            open ? 'w-10 px-0' : 'project-agent-chat-toggle-collapsed h-11 w-full'
          }`}
          onClick={onToggle}
          type="button"
          aria-label={open ? 'Hide agent chat' : 'Show agent chat'}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Agent
            </>
          )}
        </button>
      </div>

      {open ? (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              const text = getMessageText(message);
              if (!text) return null;
              const isUser = message.role === 'user';
              return (
                <div
                  className={`block max-w-[86%] rounded-[14px] px-4 py-3 text-left text-sm leading-6 ${
                    isUser
                      ? 'ml-auto bg-black text-white'
                      : 'mr-auto border border-[#eeeeee] bg-[#fafafa] text-black'
                  }`}
                  key={message.id}
                >
                  {text}
                </div>
              );
            })}
            {isBusy ? (
              <div className="mr-auto max-w-[86%] rounded-[14px] border border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-sm leading-6 text-[#666666]">
                Thinking...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form className="space-y-2 bg-white px-4 pb-4 pt-2" onSubmit={handleSubmit}>
            {statusNote ? (
              <p className="mb-3 rounded-[12px] border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-xs leading-5 text-[#666666]">{statusNote}</p>
            ) : null}

            {promptTemplates.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {promptTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="project-agent-press-button inline-flex h-9 min-w-0 items-center justify-center rounded-[12px] border border-[#dedede] bg-[#fafafa] px-2 text-xs font-medium text-[#242424] shadow-[0_4px_12px_rgba(0,0,0,0.035)] transition-colors hover:border-[#bdbdbd] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                    onClick={() => onUseTemplate?.(template.text)}
                    title={template.label}
                  >
                    <span className="truncate">{template.label}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="rounded-[20px] border border-[#dedede] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow focus-within:shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
              <div className="relative">
                <textarea
                  className={`project-agent-chat-input-field w-full resize-none appearance-none border-0 bg-transparent py-2 pl-2 pr-11 text-sm leading-5 text-black shadow-none outline-none ring-0 placeholder:text-[#777777] focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${
                    composerExpanded ? 'min-h-[168px] max-h-[260px]' : 'min-h-[72px] max-h-[136px]'
                  }`}
                  disabled={isBusy}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.shiftKey) return;
                    event.preventDefault();
                    if (!isBusy && draft.trim()) {
                      onSubmit();
                    }
                  }}
                  placeholder="Message agent..."
                  value={draft}
                  aria-label="Message agent"
                />
                <button
                  className="project-agent-press-button absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#666666] transition-colors hover:bg-[#f5f5f5] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
                  type="button"
                  aria-label={composerExpanded ? 'Collapse prompt input' : 'Expand prompt input'}
                  onClick={() => setComposerExpanded((expanded) => !expanded)}
                >
                  {composerExpanded ? (
                    <Minimize2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="relative">
                  <button
                    className="project-agent-press-button inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dedede] bg-white text-black shadow-[0_4px_0_#d6d6d6,0_8px_16px_rgba(0,0,0,0.08)] transition-all hover:bg-[#f8f8f8] active:translate-y-[2px] active:shadow-[0_2px_0_#d6d6d6,0_4px_10px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                    type="button"
                    aria-label="Add assets"
                    aria-expanded={assetMenuOpen}
                    onClick={() => setAssetMenuOpen((current) => !current)}
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>

                  {assetMenuOpen ? (
                    <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-52 rounded-[14px] border border-[#dedede] bg-white p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.14)]">
                      <button
                        className="flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-medium text-black transition-colors hover:bg-[#f7f7f7]"
                        type="button"
                        onClick={() => handleAssetCreateRequest('avatar')}
                      >
                        <UserPlus className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                        Avatar
                      </button>
                      <button
                        className="flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-medium text-black transition-colors hover:bg-[#f7f7f7]"
                        type="button"
                        onClick={() => handleAssetCreateRequest('product')}
                      >
                        <PackagePlus className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                        Product
                      </button>
                      <button
                        className="flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-medium text-black transition-colors hover:bg-[#f7f7f7]"
                        type="button"
                        onClick={() => handleAssetCreateRequest('video')}
                      >
                        <Video className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                        Video
                      </button>
                    </div>
                  ) : null}
                </div>

                <button
                  className="project-agent-send-button inline-flex h-10 min-w-10 items-center justify-center rounded-full px-4 transition-all disabled:cursor-not-allowed"
                  disabled={isBusy || !draft.trim()}
                  style={{
                    background: '#111111',
                    borderColor: '#111111',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 0 rgba(0,0,0,0.96), 0 10px 18px rgba(0,0,0,0.18)',
                    color: '#ffffff',
                    opacity: 1,
                  }}
                  type="submit"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
        </>
      ) : null}
    </aside>
  );
}
