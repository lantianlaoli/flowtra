'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { ShoppingBag, User } from 'lucide-react';
import { getActiveMentionQuery } from '@/lib/prompt-mention';
import {
  buildMentionToken,
  MENTION_TOKEN_REGEX,
  normalizeMentionLabel,
  parseMentionToken
} from '@/lib/prompt-mention-tokens';

type MentionType = 'character' | 'product';

export type PromptMentionItem = {
  id: string;
  label: string;
  type: MentionType;
  imageUrl?: string | null;
  photoCount?: number;
};

type PromptMentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  resizable?: 'none' | 'vertical';
  allowWrappedMentions?: boolean;
  preventHorizontalScroll?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
  characterMentions?: Array<{ id: string; label: string; imageUrl?: string | null; photoCount?: number }>;
  productMentions?: Array<{ id: string; label: string; imageUrl?: string | null; photoCount?: number }>;
  enforcePhotoCount?: boolean;
  minRequiredPhotos?: number;
  insufficientPhotosLabel?: string;
  className?: string;
};

type HighlightSegment =
  | { kind: 'text'; text: string }
  | { kind: 'token'; raw: string; type: MentionType | 'unknown'; key: string; label: string; trailingWhitespace: string };

const parseHighlightedSegments = (value: string): HighlightSegment[] => {
  if (!value) return [];

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_TOKEN_REGEX.lastIndex = 0;

  while ((match = MENTION_TOKEN_REGEX.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: value.slice(lastIndex, match.index) });
    }

    let tokenEnd = match.index + match[0].length;
    let trailingWhitespace = '';
    while (value[tokenEnd] === ' ') {
      trailingWhitespace += ' ';
      tokenEnd += 1;
    }

    const parsed = parseMentionToken(match[0]);
    if (parsed) {
      segments.push({
        kind: 'token',
        raw: match[0],
        type: parsed.type,
        key: parsed.key,
        label: parsed.label,
        trailingWhitespace
      });
    } else {
      segments.push({ kind: 'text', text: `${match[0]}${trailingWhitespace}` });
    }

    lastIndex = tokenEnd;
  }

  if (lastIndex < value.length) {
    segments.push({ kind: 'text', text: value.slice(lastIndex) });
  }

  return segments;
};

export default function PromptMentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 6,
  resizable = 'none',
  allowWrappedMentions = false,
  preventHorizontalScroll = false,
  disabled,
  readOnly,
  hasError,
  characterMentions = [],
  productMentions = [],
  enforcePhotoCount = false,
  minRequiredPhotos = 2,
  insufficientPhotosLabel = 'Need 2 photos',
  className,
}: PromptMentionTextareaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuScrollRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const mentionEnabled = characterMentions.length > 0 || productMentions.length > 0;

  const highlightedSegments = useMemo(() => parseHighlightedSegments(value), [value]);

  const filteredCharacters = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return characterMentions;
    return characterMentions.filter((item) => item.label.toLowerCase().includes(query));
  }, [characterMentions, mentionQuery]);

  const filteredProducts = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return productMentions;
    return productMentions.filter((item) => item.label.toLowerCase().includes(query));
  }, [productMentions, mentionQuery]);

  const flatItems = useMemo<PromptMentionItem[]>(() => (
    [
      ...filteredCharacters.map((item) => ({ ...item, type: 'character' as const })),
      ...filteredProducts.map((item) => ({ ...item, type: 'product' as const }))
    ]
  ), [filteredCharacters, filteredProducts]);

  const characterImageMap = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    characterMentions.forEach((item) => map.set(normalizeMentionLabel(item.label), item.imageUrl));
    return map;
  }, [characterMentions]);

  const productImageMap = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    productMentions.forEach((item) => map.set(normalizeMentionLabel(item.label), item.imageUrl));
    return map;
  }, [productMentions]);

  const mentionMetaMap = useMemo(() => {
    const map = new Map<string, { type: MentionType; label: string; imageUrl?: string | null }>();

    characterMentions.forEach((item) => {
      const key = normalizeMentionLabel(item.label);
      if (!key || map.has(key)) return;
      map.set(key, {
        type: 'character',
        label: item.label,
        imageUrl: item.imageUrl
      });
    });

    productMentions.forEach((item) => {
      const key = normalizeMentionLabel(item.label);
      if (!key || map.has(key)) return;
      map.set(key, {
        type: 'product',
        label: item.label,
        imageUrl: item.imageUrl
      });
    });

    return map;
  }, [characterMentions, productMentions]);

  const isItemDisabled = (item: PromptMentionItem) => {
    if (!enforcePhotoCount) return false;
    const count = item.photoCount ?? (item.imageUrl ? 1 : 0);
    return count < minRequiredPhotos;
  };

  const closeMention = () => {
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery('');
  };

  const updateMentionState = (nextValue: string, caret: number) => {
    if (!mentionEnabled || disabled || readOnly) {
      closeMention();
      return;
    }

    const mention = getActiveMentionQuery(nextValue, caret);
    if (!mention) {
      closeMention();
      return;
    }

    const shouldResetActiveIndex = !mentionOpen || mention.start !== mentionStart || mention.query !== mentionQuery;
    setMentionStart(mention.start);
    setMentionQuery(mention.query);
    setMentionOpen(true);
    if (shouldResetActiveIndex) {
      setActiveIndex(0);
    }
  };

  const syncMentionFromTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    updateMentionState(textarea.value, textarea.selectionStart ?? textarea.value.length);
  };

  const insertMention = (item: PromptMentionItem) => {
    if (isItemDisabled(item)) return;
    const textarea = textareaRef.current;
    if (!textarea || mentionStart === null) return;

    const selectionStart = textarea.selectionStart ?? value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const token = buildMentionToken(item);
    const replaceEnd = Math.max(selectionEnd, mentionStart + 1 + mentionQuery.length);
    const trailingText = value.slice(replaceEnd);
    const needsSpace = trailingText.length === 0 || !/^\s/.test(trailingText);
    const spacer = needsSpace ? ' ' : '';
    const nextValue = `${value.slice(0, mentionStart)}${token}${spacer}${value.slice(replaceEnd)}`;
    const nextCaret = mentionStart + token.length + spacer.length;

    onChange(nextValue);
    closeMention();

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

  useEffect(() => {
    if (!mentionOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        closeMention();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [mentionOpen]);

  useEffect(() => {
    if (!mentionOpen) return;
    const activeOption = optionRefs.current[activeIndex];
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, mentionOpen]);

  return (
    <div ref={rootRef} className="prompt-mention-root relative min-w-0">
      <div
        className={clsx(
          'relative overflow-hidden rounded-lg border bg-white transition-colors',
          hasError ? 'border-red-500 focus-within:border-red-500' : 'border-gray-200 focus-within:border-black',
          readOnly || disabled ? 'bg-gray-50' : ''
        )}
      >
        {!isFocused && value ? (
          <div
            className={clsx(
              'pointer-events-none absolute inset-0 z-10 overflow-hidden px-3 py-2 text-sm leading-6 text-[#1f1f1e] whitespace-pre-wrap break-words',
              preventHorizontalScroll ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto'
            )}
            aria-hidden="true"
          >
            {highlightedSegments.map((segment, index) => {
              if (segment.kind === 'text') {
                return <span key={`text-${index}`}>{segment.text}</span>;
              }

              const resolvedMeta = mentionMetaMap.get(segment.key);
              const resolvedType = segment.type === 'unknown'
                ? (resolvedMeta?.type || 'character')
                : segment.type;
              const resolvedLabel = resolvedMeta?.label || segment.label;
              const mentionImage = resolvedType === 'character'
                ? characterImageMap.get(segment.key)
                : productImageMap.get(segment.key);

              return (
                <span key={`token-${segment.raw}-${index}`} className="inline-flex max-w-full items-center align-middle">
                  <span className="prompt-mention-token inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-lg bg-[#eef2f7] px-2 py-0.5 text-[#1f1f1e] ring-1 ring-inset ring-[#d4dbe6]">
                    <span className="shrink-0 text-[#6b7280]">@</span>
                    <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-[#d4dbe6]">
                      {mentionImage ? (
                        <NextImage src={mentionImage} alt={resolvedLabel} fill sizes="16px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[#6b7280]">
                          {resolvedType === 'product' ? <ShoppingBag className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        </span>
                      )}
                    </span>
                    <span className="leading-6" title={resolvedLabel}>{resolvedLabel}</span>
                  </span>
                  {segment.trailingWhitespace}
                </span>
              );
            })}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            updateMentionState(nextValue, event.target.selectionStart ?? nextValue.length);
          }}
          onKeyDown={(event) => {
            if (!mentionOpen) return;

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((prev) => (prev + 1) % Math.max(flatItems.length, 1));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((prev) => (prev - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1));
              return;
            }
            if (event.key === 'Enter') {
              if (flatItems.length > 0) {
                event.preventDefault();
                if (!isItemDisabled(flatItems[activeIndex])) {
                  insertMention(flatItems[activeIndex]);
                }
              }
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              closeMention();
            }
          }}
          onSelect={syncMentionFromTextarea}
          onClick={syncMentionFromTextarea}
          onKeyUp={syncMentionFromTextarea}
          onFocus={() => {
            setIsFocused(true);
            syncMentionFromTextarea();
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          rows={rows}
          disabled={disabled}
          readOnly={readOnly}
          spellCheck={false}
          placeholder={placeholder}
          style={{
            resize: resizable === 'vertical' ? 'vertical' : 'none'
          }}
          className={clsx(
            'block w-full border-0 bg-transparent px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-0',
            preventHorizontalScroll ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto',
            resizable === 'vertical' ? 'resize-y' : 'resize-none',
            !isFocused && value ? 'text-transparent caret-transparent selection:bg-transparent selection:text-transparent' : 'text-[#1f1f1e]',
            readOnly || disabled ? 'cursor-not-allowed bg-gray-50' : '',
            className
          )}
        />
      </div>

      {mentionOpen && (
        <div role="listbox" className="prompt-mention-menu absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
          <div ref={menuScrollRef} className="max-h-64 space-y-2 overflow-y-auto p-2">
            <div>
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <User className="h-3.5 w-3.5" />
                <span>Character</span>
              </div>
              {filteredCharacters.length === 0 ? (
                <p className="px-2 py-1 text-xs text-gray-400">No characters found</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {filteredCharacters.map((item, index) => {
                    const flatIndex = index;
                    const isActive = flatIndex === activeIndex;
                    const isDisabled = isItemDisabled({ ...item, type: 'character' });
                    return (
                      <button
                        key={`character-${item.id}`}
                        ref={(node) => {
                          optionRefs.current[flatIndex] = node;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        disabled={isDisabled}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (isDisabled) return;
                          insertMention({ id: item.id, label: item.label, type: 'character', imageUrl: item.imageUrl, photoCount: item.photoCount });
                        }}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                          isDisabled
                            ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                            : isActive
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-900 hover:bg-gray-100'
                        )}
                      >
                        <span className={clsx('relative h-9 w-9 overflow-hidden rounded-full border', isActive ? 'border-white/60' : 'border-gray-200')}>
                          {item.imageUrl ? (
                            <NextImage src={item.imageUrl} alt={item.label} fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className={clsx('flex h-full w-full items-center justify-center', isActive ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500')}>
                              <User className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {isDisabled && (
                          <span className="rounded-xl border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                            {insufficientPhotosLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Product</span>
              </div>
              {filteredProducts.length === 0 ? (
                <p className="px-2 py-1 text-xs text-gray-400">No products found</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {filteredProducts.map((item, index) => {
                    const flatIndex = filteredCharacters.length + index;
                    const isActive = flatIndex === activeIndex;
                    const isDisabled = isItemDisabled({ ...item, type: 'product' });
                    return (
                      <button
                        key={`product-${item.id}`}
                        ref={(node) => {
                          optionRefs.current[flatIndex] = node;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        disabled={isDisabled}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (isDisabled) return;
                          insertMention({ id: item.id, label: item.label, type: 'product', imageUrl: item.imageUrl, photoCount: item.photoCount });
                        }}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                          isDisabled
                            ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                            : isActive
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-900 hover:bg-gray-100'
                        )}
                      >
                        <span className={clsx('relative h-9 w-9 overflow-hidden rounded-full border', isActive ? 'border-white/60' : 'border-gray-200')}>
                          {item.imageUrl ? (
                            <NextImage src={item.imageUrl} alt={item.label} fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className={clsx('flex h-full w-full items-center justify-center', isActive ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500')}>
                              <ShoppingBag className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {isDisabled && (
                          <span className="rounded-xl border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                            {insufficientPhotosLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
