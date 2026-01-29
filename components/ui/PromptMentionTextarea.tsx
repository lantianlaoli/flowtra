'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { ShoppingBag, User } from 'lucide-react';

type MentionType = 'character' | 'product';

export type PromptMentionItem = {
  id: string;
  label: string;
  type: MentionType;
  imageUrl?: string | null;
};

type PromptMentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
  characterMentions?: Array<{ id: string; label: string; imageUrl?: string | null }>;
  productMentions?: Array<{ id: string; label: string; imageUrl?: string | null }>;
  className?: string;
};

const TOKEN_REGEX = /@(?:character|product)\([^)]*\)/g;

const buildMentionToken = (item: PromptMentionItem) => `@${item.type}(${item.label})`;

const isValidMentionStart = (text: string, index: number) => {
  if (index === 0) return true;
  return /\s/.test(text[index - 1]);
};

export default function PromptMentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 6,
  disabled,
  readOnly,
  hasError,
  characterMentions = [],
  productMentions = [],
  className,
}: PromptMentionTextareaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const suppressSelectionUpdateRef = useRef(false);
  const localUpdateRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);
  const lastValueRef = useRef(value);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastCaretDirection, setLastCaretDirection] = useState<'left' | 'right' | null>(null);

  const filteredCharacters = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return characterMentions;
    return characterMentions.filter(item => item.label.toLowerCase().includes(query));
  }, [characterMentions, mentionQuery]);

  const filteredProducts = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return productMentions;
    return productMentions.filter(item => item.label.toLowerCase().includes(query));
  }, [productMentions, mentionQuery]);

  const flatItems = useMemo<PromptMentionItem[]>(() => {
    return [
      ...filteredCharacters.map(item => ({ ...item, type: 'character' as const })),
      ...filteredProducts.map(item => ({ ...item, type: 'product' as const }))
    ];
  }, [filteredCharacters, filteredProducts]);

  const updateMentionState = (nextValue: string, caret: number) => {
    if (disabled || readOnly) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery('');
      return;
    }
    const textBefore = nextValue.slice(0, caret);
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex === -1 || !isValidMentionStart(textBefore, atIndex)) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery('');
      return;
    }
    const after = textBefore.slice(atIndex + 1);
    if (/\s/.test(after)) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery('');
      return;
    }
    setMentionStart(atIndex);
    setMentionQuery(after);
    setMentionOpen(true);
    setActiveIndex(0);
  };

  const syncHistoryFromExternalValue = (nextValue: string) => {
    if (historyRef.current.length === 0) {
      historyRef.current = [nextValue];
      historyIndexRef.current = 0;
      lastValueRef.current = nextValue;
      return;
    }
    if (localUpdateRef.current) {
      localUpdateRef.current = false;
      lastValueRef.current = nextValue;
      return;
    }
    if (nextValue !== lastValueRef.current) {
      historyRef.current = [nextValue];
      historyIndexRef.current = 0;
      lastValueRef.current = nextValue;
    }
  };

  const commitValue = (nextValue: string) => {
    localUpdateRef.current = true;
    if (historyRef.current.length === 0) {
      historyRef.current = [value];
      historyIndexRef.current = 0;
    }
    const current = historyRef.current[historyIndexRef.current] ?? lastValueRef.current;
    if (nextValue !== current) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(nextValue);
      historyIndexRef.current = historyRef.current.length - 1;
    }
    lastValueRef.current = nextValue;
    onChange(nextValue);
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const nextValue = historyRef.current[historyIndexRef.current];
    localUpdateRef.current = true;
    lastValueRef.current = nextValue;
    onChange(nextValue);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const nextValue = historyRef.current[historyIndexRef.current];
    localUpdateRef.current = true;
    lastValueRef.current = nextValue;
    onChange(nextValue);
  };

  const getTokenRanges = (text: string) => {
    TOKEN_REGEX.lastIndex = 0;
    const ranges: Array<{ start: number; end: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = TOKEN_REGEX.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    return ranges;
  };

  const findTokenAt = (text: string, index: number) => {
    const ranges = getTokenRanges(text);
    return ranges.find(range => index > range.start && index < range.end) || null;
  };

  const snapSelectionIfInsideToken = () => {
    const target = textareaRef.current;
    if (!target) return;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? start;
    const token = findTokenAt(value, start);
    if (!token) return;
    const nextPosition = lastCaretDirection === 'left' ? token.start : token.end;
    target.setSelectionRange(nextPosition, nextPosition);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    commitValue(nextValue);
    updateMentionState(nextValue, event.target.selectionStart ?? nextValue.length);
  };

  const handleSelectionUpdate = () => {
    const target = textareaRef.current;
    if (!target) return;
    if (suppressSelectionUpdateRef.current) {
      suppressSelectionUpdateRef.current = false;
      return;
    }
    updateMentionState(target.value, target.selectionStart ?? target.value.length);
    snapSelectionIfInsideToken();
  };

  const handleScroll = () => {
    if (!textareaRef.current || !overlayRef.current) return;
    overlayRef.current.scrollTop = textareaRef.current.scrollTop;
  };

  const closeMention = () => {
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery('');
  };

  const insertMention = (item: PromptMentionItem) => {
    const target = textareaRef.current;
    if (!target || mentionStart === null) return;
    const caret = target.selectionStart ?? value.length;
    const token = buildMentionToken(item);
    const trailingText = value.slice(caret);
    const needsSpace = trailingText.length === 0 || !/^\s/.test(trailingText);
    const spacer = needsSpace ? ' ' : '';
    const nextValue = `${value.slice(0, mentionStart)}${token}${spacer}${trailingText}`;
    const nextCaret = mentionStart + token.length + spacer.length;
    commitValue(nextValue);
    closeMention();
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
    const isRedo = (event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    if (isUndo) {
      event.preventDefault();
      undo();
      return;
    }
    if (isRedo) {
      event.preventDefault();
      redo();
      return;
    }
    if (!mentionOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      suppressSelectionUpdateRef.current = true;
      setActiveIndex(prev => (prev + 1) % Math.max(flatItems.length, 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      suppressSelectionUpdateRef.current = true;
      setActiveIndex(prev => (prev - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1));
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      setLastCaretDirection(event.key === 'ArrowLeft' ? 'left' : 'right');
      const target = textareaRef.current;
      if (!target) return;
      const caret = target.selectionStart ?? 0;
      const token = findTokenAt(value, caret);
      if (token) {
        event.preventDefault();
        const nextPosition = event.key === 'ArrowLeft' ? token.start : token.end;
        target.setSelectionRange(nextPosition, nextPosition);
        return;
      }
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const target = textareaRef.current;
      if (!target) return;
      const caret = target.selectionStart ?? 0;
      const token = findTokenAt(value, caret);
      if (token) {
        event.preventDefault();
        const nextValue = `${value.slice(0, token.start)}${value.slice(token.end)}`;
        commitValue(nextValue);
        requestAnimationFrame(() => {
          target.focus();
          target.setSelectionRange(token.start, token.start);
        });
        return;
      }
      const ranges = getTokenRanges(value);
      if (event.key === 'Backspace') {
        const prevToken = ranges.find(range => range.end === caret);
        if (prevToken) {
          event.preventDefault();
          const nextValue = `${value.slice(0, prevToken.start)}${value.slice(prevToken.end)}`;
          commitValue(nextValue);
          requestAnimationFrame(() => {
            target.focus();
            target.setSelectionRange(prevToken.start, prevToken.start);
          });
        }
      } else {
        const nextToken = ranges.find(range => range.start === caret);
        if (nextToken) {
          event.preventDefault();
          const nextValue = `${value.slice(0, nextToken.start)}${value.slice(nextToken.end)}`;
          commitValue(nextValue);
          requestAnimationFrame(() => {
            target.focus();
            target.setSelectionRange(nextToken.start, nextToken.start);
          });
        }
      }
      return;
    }
    if (event.key === 'Enter') {
      if (flatItems.length > 0) {
        event.preventDefault();
        insertMention(flatItems[activeIndex]);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMention();
    }
  };

  const highlightedContent = useMemo(() => {
    if (!value) return '';
    TOKEN_REGEX.lastIndex = 0;
    const segments: Array<{ text: string; highlighted: boolean }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_REGEX.exec(value)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: value.slice(lastIndex, match.index), highlighted: false });
      }
      let tokenText = match[0];
      let tokenEnd = match.index + match[0].length;
      if (value[tokenEnd] === ' ') {
        tokenText += ' ';
        tokenEnd += 1;
      }
      segments.push({ text: tokenText, highlighted: true });
      lastIndex = tokenEnd;
    }
    if (lastIndex < value.length) {
      segments.push({ text: value.slice(lastIndex), highlighted: false });
    }
    return segments;
  }, [value]);

  useEffect(() => {
    syncHistoryFromExternalValue(value);
  }, [value]);

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

  return (
    <div ref={rootRef} className="relative">
      <div
        ref={overlayRef}
        className={clsx(
          'pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2 text-sm',
          readOnly ? 'text-gray-500' : 'text-gray-900'
        )}
        aria-hidden="true"
      >
        {Array.isArray(highlightedContent)
          ? highlightedContent.map((segment, index) =>
              segment.highlighted ? (
                <span
                  key={`${segment.text}-${index}`}
                  className={clsx(
                    'rounded-md ring-1 ring-inset',
                    segment.text.startsWith('@character(')
                      ? 'bg-blue-100 text-blue-900 ring-blue-200'
                      : 'bg-amber-100 text-amber-900 ring-amber-200'
                  )}
                >
                  {segment.text}
                </span>
              ) : (
                <span key={`${segment.text}-${index}`}>{segment.text}</span>
              )
            )
          : highlightedContent}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleSelectionUpdate}
        onClick={handleSelectionUpdate}
        onScroll={handleScroll}
        rows={rows}
        disabled={disabled}
        readOnly={readOnly}
        className={clsx(
          'relative w-full rounded-2xl border bg-transparent px-3 py-2 text-sm text-transparent caret-black focus:outline-none focus:ring-2',
          hasError
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-200 focus:ring-gray-900 focus:border-gray-900',
          readOnly || disabled ? 'cursor-not-allowed bg-gray-50' : '',
          'placeholder:text-gray-400',
          className
        )}
        placeholder={placeholder}
      />
      {mentionOpen && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto p-2 space-y-2">
            <div>
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
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
                    return (
                      <button
                        key={`character-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={event => {
                          event.preventDefault();
                          insertMention({ id: item.id, label: item.label, type: 'character', imageUrl: item.imageUrl });
                        }}
                        className={clsx(
                          'w-full rounded-xl px-3 py-2 text-left text-sm transition flex items-center gap-3',
                          isActive ? 'bg-gray-900 text-white' : 'text-gray-900 hover:bg-gray-100'
                        )}
                      >
                        <span className={clsx('relative h-9 w-9 rounded-full overflow-hidden border', isActive ? 'border-white/60' : 'border-gray-200')}>
                          {item.imageUrl ? (
                            <NextImage src={item.imageUrl} alt={item.label} fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className={clsx('flex h-full w-full items-center justify-center', isActive ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500')}>
                              <User className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
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
                    return (
                      <button
                        key={`product-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={event => {
                          event.preventDefault();
                          insertMention({ id: item.id, label: item.label, type: 'product', imageUrl: item.imageUrl });
                        }}
                        className={clsx(
                          'w-full rounded-xl px-3 py-2 text-left text-sm transition flex items-center gap-3',
                          isActive ? 'bg-gray-900 text-white' : 'text-gray-900 hover:bg-gray-100'
                        )}
                      >
                        <span className={clsx('relative h-9 w-9 rounded-full overflow-hidden border', isActive ? 'border-white/60' : 'border-gray-200')}>
                          {item.imageUrl ? (
                            <NextImage src={item.imageUrl} alt={item.label} fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className={clsx('flex h-full w-full items-center justify-center', isActive ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500')}>
                              <ShoppingBag className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
