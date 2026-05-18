'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { ArrowUp, CopyPlus, Film, Package2, Plus, Rocket, Sparkles, Type, User, Video } from 'lucide-react';

export type PromptCommandKind = 'asset' | 'feature' | 'text';
export type PromptCommandAssetType = 'avatar' | 'product' | 'video';

export type PromptCommand = {
  id: string;
  label: string;
  prompt: string;
  kind: PromptCommandKind;
  groupLabel?: string;
  chipLabel?: string;
  assetType?: PromptCommandAssetType;
  assetId?: string;
  imageUrl?: string | null;
  icon?: ComponentType<{ className?: string }>;
};

export type PromptSubmitPayload = {
  message: string;
  commands: PromptCommand[];
  detailText: string;
  tikTokLinks: string[];
};

export type PromptTemplatePart =
  | { type: 'text'; text: string }
  | { type: 'command'; command: PromptCommand };

type PromptInputBoxProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string, payload: PromptSubmitPayload) => void;
  isLoading?: boolean;
  placeholder?: string;
  statusNote?: string;
  commands?: PromptCommand[];
  onAssetCreateRequest?: (assetType: PromptCommandAssetType) => void;
  injectedCommandToken?: { nonce: string; command: PromptCommand } | null;
  injectedPromptTemplate?: { nonce: string; parts: PromptTemplatePart[] } | null;
  className?: string;
};

type ActiveCommandTrigger = {
  trigger: '/' | '@';
  start: number;
  end: number;
};

type PromptPart =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'command'; command: PromptCommand };

type UploadOption = {
  assetType: PromptCommandAssetType;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const TIKTOK_URL_REGEX = /https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/[^\s<>"']+/gi;

const DEFAULT_COMMANDS: PromptCommand[] = [
  { id: 'text', label: 'Instruction', prompt: 'Add an Instruction node to the canvas.', kind: 'text', groupLabel: 'Functions', icon: Type },
  { id: 'video-clone', label: 'Video Clone', prompt: 'Add a Video Clone node to the canvas.', kind: 'feature', groupLabel: 'Functions', icon: CopyPlus },
  { id: 'avatar-ads', label: 'Avatar Ads', prompt: 'Add an Avatar Ads node to the canvas.', kind: 'feature', groupLabel: 'Functions', icon: User },
  { id: 'motion-clone', label: 'Motion Clone', prompt: 'Add a Motion Clone node to the canvas.', kind: 'feature', groupLabel: 'Functions', icon: Sparkles },
];

const UPLOAD_OPTIONS: UploadOption[] = [
  { assetType: 'avatar', label: 'Avatar', icon: User },
  { assetType: 'product', label: 'Product', icon: Package2 },
  { assetType: 'video', label: 'Video', icon: Video },
];

const extractTikTokLinks = (value: string) => {
  const matches = value.match(TIKTOK_URL_REGEX) || [];
  return Array.from(new Set(matches.map((match) => match.replace(/[),.;]+$/, ''))));
};

const getCommandFallbackIcon = (command: PromptCommand) => {
  if (command.icon) return command.icon;
  if (command.assetType === 'avatar') return User;
  if (command.assetType === 'product') return Package2;
  if (command.assetType === 'video') return Video;
  if (command.kind === 'text') return Type;
  return Film;
};

const getCommandChipLabel = (command: PromptCommand) => {
  if (command.chipLabel) return command.chipLabel;
  if (command.assetType === 'avatar') return `Avatar: ${command.label}`;
  if (command.assetType === 'product') return `Product: ${command.label}`;
  if (command.assetType === 'video') return `Video: ${command.label}`;
  return command.label;
};

const getActiveCommandTrigger = (input: string): ActiveCommandTrigger | null => {
  const candidates = [
    { trigger: '/' as const, start: input.lastIndexOf('/') },
    { trigger: '@' as const, start: input.lastIndexOf('@') },
  ]
    .filter((candidate) => candidate.start >= 0)
    .filter((candidate) => {
      if (candidate.trigger === '@') return true;
      return candidate.start === 0 || /\s/.test(input[candidate.start - 1]);
    })
    .sort((a, b) => b.start - a.start);

  const candidate = candidates[0];
  if (!candidate) return null;

  const token = input.slice(candidate.start);
  if (/\s/.test(token)) return null;

  return {
    trigger: candidate.trigger,
    start: candidate.start,
    end: input.length,
  };
};

export function PromptInputBox({
  value,
  onValueChange,
  onSend,
  isLoading = false,
  placeholder = 'Describe the canvas you want...',
  statusNote,
  commands = DEFAULT_COMMANDS,
  onAssetCreateRequest,
  injectedCommandToken,
  injectedPromptTemplate,
  className = '',
}: PromptInputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commandMenuRef = useRef<HTMLDivElement | null>(null);
  const commandButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const promptPartIdRef = useRef(0);
  const lastInjectedCommandNonceRef = useRef<string | null>(null);
  const lastInjectedTemplateNonceRef = useRef<string | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandMenuTrigger, setCommandMenuTrigger] = useState<'/' | '@' | null>(null);
  const [commandTriggerRange, setCommandTriggerRange] = useState<ActiveCommandTrigger | null>(null);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [promptParts, setPromptParts] = useState<PromptPart[]>([]);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [promptFlowActive, setPromptFlowActive] = useState(false);
  const promptFlowTimeoutRef = useRef<number | null>(null);

  const committedText = useMemo(
    () => promptParts.map((part) => (part.type === 'text' ? part.text : '')).join(''),
    [promptParts]
  );
  const tikTokLinks = useMemo(() => extractTikTokLinks(`${committedText}${value}`), [committedText, value]);
  const visibleCommands = useMemo(() => {
    if (commandMenuTrigger === '@') {
      return commands.filter((command) => command.kind === 'asset');
    }

    if (commandMenuTrigger === '/') {
      return commands.filter((command) => command.kind !== 'asset');
    }

    return [];
  }, [commandMenuTrigger, commands]);
  const groupedCommands = useMemo(() => {
    const groups: Array<{ label: string; commands: PromptCommand[] }> = [];
    visibleCommands.forEach((command) => {
      const label = command.groupLabel || 'Functions';
      const existing = groups.find((group) => group.label === label);
      if (existing) {
        existing.commands.push(command);
        return;
      }
      groups.push({ label, commands: [command] });
    });
    return groups;
  }, [visibleCommands]);
  const canSend = (value.trim().length > 0 || promptParts.length > 0) && !isLoading;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 52), 180)}px`;
  }, [value]);

  useEffect(() => () => {
    if (promptFlowTimeoutRef.current) {
      window.clearTimeout(promptFlowTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const activeTrigger = getActiveCommandTrigger(value);
    setCommandTriggerRange(activeTrigger);
    setCommandMenuTrigger(activeTrigger?.trigger ?? null);
    setCommandMenuOpen(Boolean(activeTrigger));
    if (activeTrigger) {
      setActiveCommandIndex(0);
    }
  }, [value]);

  useEffect(() => {
    if (!commandMenuOpen) return;
    const activeCommand = visibleCommands[activeCommandIndex];
    const menu = commandMenuRef.current;
    const button = activeCommand ? commandButtonRefs.current[activeCommand.id] : null;
    if (!menu || !button) return;

    const menuTop = menu.scrollTop;
    const menuBottom = menuTop + menu.clientHeight;
    const buttonTop = button.offsetTop;
    const buttonBottom = buttonTop + button.offsetHeight;

    if (buttonTop < menuTop) {
      menu.scrollTo({ top: Math.max(buttonTop - 8, 0), behavior: 'smooth' });
      return;
    }

    if (buttonBottom > menuBottom) {
      menu.scrollTo({ top: buttonBottom - menu.clientHeight + 8, behavior: 'smooth' });
    }
  }, [activeCommandIndex, commandMenuOpen, visibleCommands]);

  useEffect(() => {
    if (activeCommandIndex < visibleCommands.length) return;
    setActiveCommandIndex(0);
  }, [activeCommandIndex, visibleCommands.length]);

  const appendCommandToken = (command: PromptCommand, range?: { start: number; end: number }) => {
    const textBeforeTrigger = range ? value.slice(0, range.start) : '';
    const textAfterTrigger = range ? value.slice(range.end) : value;
    const nextParts: PromptPart[] = [];

    if (textBeforeTrigger.length > 0) {
      nextParts.push({
        id: `text:${promptPartIdRef.current++}`,
        type: 'text',
        text: textBeforeTrigger,
      });
    }

    nextParts.push({
      id: `command:${promptPartIdRef.current++}`,
      type: 'command',
      command,
    });

    setPromptParts((current) => [...current, ...nextParts]);
    if (range) {
      onValueChange(textAfterTrigger);
    } else {
      onValueChange(value);
    }
  };

  const selectCommand = (command: PromptCommand) => {
    appendCommandToken(command, commandTriggerRange || undefined);
    setCommandMenuOpen(false);
    setUploadMenuOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  useEffect(() => {
    if (!injectedCommandToken || lastInjectedCommandNonceRef.current === injectedCommandToken.nonce) return;
    lastInjectedCommandNonceRef.current = injectedCommandToken.nonce;
    appendCommandToken(injectedCommandToken.command, { start: value.length, end: value.length });
    setUploadMenuOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [injectedCommandToken]);

  useEffect(() => {
    if (!injectedPromptTemplate || lastInjectedTemplateNonceRef.current === injectedPromptTemplate.nonce) return;
    lastInjectedTemplateNonceRef.current = injectedPromptTemplate.nonce;
    const nextParts = injectedPromptTemplate.parts.map((part) => {
      if (part.type === 'text') {
        return {
          id: `text:${promptPartIdRef.current++}`,
          type: 'text' as const,
          text: part.text,
        };
      }

      return {
        id: `command:${promptPartIdRef.current++}`,
        type: 'command' as const,
        command: part.command,
      };
    });
    setPromptParts(nextParts);
    onValueChange('');
    setCommandMenuOpen(false);
    setUploadMenuOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [injectedPromptTemplate, onValueChange]);

  const handleUploadOptionClick = (assetType: PromptCommandAssetType) => {
    setUploadMenuOpen(false);
    onAssetCreateRequest?.(assetType);
  };

  const triggerPromptFlowFeedback = () => {
    setPromptFlowActive(true);
    if (promptFlowTimeoutRef.current) {
      window.clearTimeout(promptFlowTimeoutRef.current);
    }
    promptFlowTimeoutRef.current = window.setTimeout(() => {
      setPromptFlowActive(false);
      promptFlowTimeoutRef.current = null;
    }, 3000);
  };

  const submit = () => {
    const draftText = value.trim();
    const detailText = `${committedText}${value}`.trim();
    const selectedCommands = promptParts.flatMap((part) => (part.type === 'command' ? [part.command] : []));
    if ((!draftText && promptParts.length === 0) || isLoading) return;
    const commandPrompt = selectedCommands.map((command) => command.prompt).join('\n');
    const message = selectedCommands.length > 0
      ? detailText
        ? `${commandPrompt}\n\nDetails: ${detailText}`
        : commandPrompt
      : detailText;
    triggerPromptFlowFeedback();
    setCommandMenuOpen(false);
    setPromptParts([]);
    onSend(message, {
      message,
      commands: selectedCommands,
      detailText,
      tikTokLinks,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (commandMenuOpen && visibleCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveCommandIndex((current) => (current + 1) % visibleCommands.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveCommandIndex((current) => (current - 1 + visibleCommands.length) % visibleCommands.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const command = visibleCommands[activeCommandIndex] || visibleCommands[0];
        if (command) {
          selectCommand(command);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setCommandMenuOpen(false);
        setUploadMenuOpen(false);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }

    if (event.key === 'Backspace' && value.length === 0 && promptParts.length > 0) {
      event.preventDefault();
      setPromptParts((current) => {
        const lastPart = current[current.length - 1];
        if (lastPart?.type === 'text') {
          onValueChange(lastPart.text);
        }
        return current.slice(0, -1);
      });
    }
  };

  return (
    <div className={`project-agent-prompt-box pointer-events-auto relative w-full max-w-[720px] ${className}`}>
      {commandMenuOpen && visibleCommands.length > 0 ? (
        <div
          ref={commandMenuRef}
          className="absolute bottom-[calc(100%+10px)] left-0 z-40 h-[320px] w-full max-w-[360px] overflow-y-auto rounded-[16px] border border-[#d8d8d4] bg-white p-2 shadow-[0_18px_42px_rgba(0,0,0,0.16)]"
        >
          {groupedCommands.map((group) => (
            <div key={group.label} className="py-1">
              <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8a84]">
                {group.label}
              </p>
              {group.commands.map((command) => {
                const index = visibleCommands.findIndex((candidate) => candidate.id === command.id);
                const Icon = getCommandFallbackIcon(command);
                const active = index === activeCommandIndex;
                return (
                  <button
                    key={command.id}
                    ref={(element) => {
                      commandButtonRefs.current[command.id] = element;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveCommandIndex(index)}
                    onClick={() => selectCommand(command)}
                    className={`flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                      active ? 'bg-black text-white' : 'text-[#252525] hover:bg-[#f5f5f2]'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border ${
                      active ? 'border-white/20 bg-white text-black' : 'border-[#dededb] bg-[#f7f7f5] text-[#666]'
                    }`}>
                      {command.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="h-full w-full object-cover" src={command.imageUrl} />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      <div className={`project-agent-prompt-shell rounded-[16px] border border-[#d8d5ca] bg-white p-2 shadow-[0_18px_42px_rgba(30,24,14,0.18)] ${promptFlowActive || isLoading ? 'project-agent-prompt-shell-flowing' : ''}`}>
        {statusNote ? (
          <p className="mb-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {statusNote}
          </p>
        ) : null}

        {tikTokLinks.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {tikTokLinks.map((link) => (
              <span
                key={link}
                className="inline-flex max-w-full items-center gap-1 rounded-[10px] border border-[#d8d5ca] bg-[#f7f7f5] px-2 py-1 text-[11px] font-semibold text-[#333]"
                title={link}
              >
                <Video className="h-3 w-3 shrink-0" />
                <span className="max-w-[260px] truncate">TikTok link detected</span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col">
          <div className="flex min-h-[52px] min-w-0 flex-1 flex-wrap items-center gap-[2px]">
            {promptParts.map((part) => {
              if (part.type === 'text') {
                return (
                  <span
                    key={part.id}
                    className="whitespace-pre-wrap px-0 text-[15px] leading-6 text-[#111]"
                  >
                    {part.text}
                  </span>
                );
              }

              const SelectedCommandIcon = getCommandFallbackIcon(part.command);
              return (
                <span
                  key={part.id}
                  className="inline-flex h-8 max-w-[260px] shrink-0 items-center gap-1 rounded-[12px] border border-[#d8d5ca] bg-[#f7f7f5] px-1.5 text-[14px] font-medium leading-none text-[#161616] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#d8d5ca] bg-white text-[#666]">
                    {part.command.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="h-full w-full object-cover" src={part.command.imageUrl} />
                    ) : (
                      <SelectedCommandIcon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="truncate">{getCommandChipLabel(part.command)}</span>
                </span>
              );
            })}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={promptParts.length > 0 ? '' : placeholder}
              rows={1}
              className="project-agent-chat-input-field min-h-[52px] min-w-[180px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-6 text-[#111] outline-none ring-0 placeholder:text-[#8b8b86] focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ outline: 'none', boxShadow: 'none' }}
            />
          </div>

          <div className="flex h-9 items-center justify-between px-1 pt-1">
            {onAssetCreateRequest ? (
              <>
                <div className="relative">
                  {uploadMenuOpen ? (
                    <div className="project-agent-upload-menu absolute bottom-[calc(100%+8px)] left-0 z-[80] w-[180px] origin-bottom-left rounded-[14px] border border-[#d8d8d4] bg-white p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.14)]">
                      {UPLOAD_OPTIONS.map((option, index) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.assetType}
                            type="button"
                            onClick={() => handleUploadOptionClick(option.assetType)}
                            className="project-agent-upload-menu-item flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold text-[#252525] transition-colors hover:bg-[#f5f5f2]"
                            style={{ animationDelay: `${index * 42}ms` }}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#f7f7f5] text-[#666]">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMenuOpen((current) => !current);
                    }}
                    disabled={isLoading}
                    className={`project-agent-plus-button flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#6d6d68] transition-colors hover:bg-[#eeeeea] hover:text-[#222] disabled:cursor-not-allowed disabled:opacity-60 ${uploadMenuOpen ? 'project-agent-plus-button-open' : ''}`}
                    aria-label="Create asset"
                  >
                    <Plus className="h-4 w-4 transition-transform duration-300 ease-out" />
                  </button>
                </div>
              </>
            ) : <span />}
            <button
              type="button"
              onMouseDown={() => {
                if (canSend) triggerPromptFlowFeedback();
              }}
              onClick={submit}
              disabled={!canSend}
              className="project-agent-send-button group relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-white transition-all hover:-translate-y-0.5 hover:bg-[#222] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#d1cec3] disabled:hover:translate-y-0 disabled:active:scale-100"
              aria-label="Send prompt"
            >
              <ArrowUp className="absolute h-4 w-4 transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:scale-75 group-hover:opacity-0" />
              <Rocket className="absolute h-4 w-4 translate-y-2 scale-75 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
