'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { ShoppingBag, User } from 'lucide-react';
import { getActiveMentionQuery } from '@/lib/prompt-mention';
import {
  buildMentionToken,
  MENTION_TOKEN_REGEX,
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

type EditorSelection = {
  start: number;
  end: number;
};

type PromptSegment =
  | { kind: 'text'; text: string }
  | { kind: 'token'; raw: string; type: MentionType; label: string };

const getNodeTextLength = (node: Node): number => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length || 0;
  }

  if (node.nodeName === 'BR') {
    return 1;
  }

  if (node instanceof HTMLElement && node.dataset.token) {
    return node.dataset.token.length;
  }

  let total = 0;
  node.childNodes.forEach((child) => {
    total += getNodeTextLength(child);
  });
  return total;
};

const serializeEditorNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeName === 'BR') {
    return '\n';
  }

  if (node instanceof HTMLElement && node.dataset.token) {
    return node.dataset.token;
  }

  let text = '';
  node.childNodes.forEach((child) => {
    text += serializeEditorNode(child);
  });
  return text;
};

const serializeEditorValue = (root: HTMLElement): string => {
  let text = '';
  root.childNodes.forEach((child) => {
    text += serializeEditorNode(child);
  });
  return text;
};

const getOffsetWithinNode = (node: Node, offset: number): number => {
  if (node.nodeType === Node.TEXT_NODE) {
    return offset;
  }

  if (node.nodeName === 'BR') {
    return Math.min(offset, 1);
  }

  if (node instanceof HTMLElement && node.dataset.token) {
    return offset > 0 ? node.dataset.token.length : 0;
  }

  let total = 0;
  const childNodes = Array.from(node.childNodes);
  for (let i = 0; i < Math.min(offset, childNodes.length); i += 1) {
    total += getNodeTextLength(childNodes[i]);
  }
  return total;
};

const getSelectionOffset = (root: HTMLElement, container: Node, offset: number): number => {
  if (container === root) {
    return getOffsetWithinNode(root, offset);
  }

  let total = 0;
  let resolved = false;

  const visit = (node: Node): boolean => {
    if (node === container) {
      total += getOffsetWithinNode(node, offset);
      resolved = true;
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR' || (node instanceof HTMLElement && node.dataset.token)) {
      total += getNodeTextLength(node);
      return false;
    }

    const childNodes = Array.from(node.childNodes);
    for (const child of childNodes) {
      if (visit(child)) return true;
    }

    return false;
  };

  Array.from(root.childNodes).some((child) => visit(child));

  return resolved ? total : serializeEditorValue(root).length;
};

const getEditorSelection = (root: HTMLElement): EditorSelection | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const start = getSelectionOffset(root, range.startContainer, range.startOffset);
  const end = getSelectionOffset(root, range.endContainer, range.endOffset);

  return {
    start: Math.min(start, end),
    end: Math.max(start, end)
  };
};

const setEditorSelection = (root: HTMLElement, targetOffset: number) => {
  const selection = window.getSelection();
  if (!selection) return;

  let remaining = targetOffset;
  let point: { node: Node; offset: number } | null = null;

  const childNodes = Array.from(root.childNodes);
  for (let index = 0; index < childNodes.length; index += 1) {
    const child = childNodes[index];
    const length = getNodeTextLength(child);

    if (child.nodeType === Node.TEXT_NODE) {
      const textLength = child.textContent?.length || 0;
      if (remaining <= textLength) {
        point = { node: child, offset: remaining };
        break;
      }
      remaining -= textLength;
      continue;
    }

    if (child.nodeName === 'BR') {
      if (remaining <= 1) {
        point = { node: root, offset: index + (remaining === 0 ? 0 : 1) };
        break;
      }
      remaining -= 1;
      continue;
    }

    if (child instanceof HTMLElement && child.dataset.token) {
      if (remaining <= length) {
        point = { node: root, offset: index + (remaining === 0 ? 0 : 1) };
        break;
      }
      remaining -= length;
      continue;
    }

    const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      const textLength = textNode.textContent?.length || 0;
      if (remaining <= textLength) {
        point = { node: textNode, offset: remaining };
        break;
      }
      remaining -= textLength;
      textNode = walker.nextNode();
    }

    if (point) break;
  }

  if (!point) {
    point = { node: root, offset: root.childNodes.length };
  }

  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

const parseSegments = (value: string): PromptSegment[] => {
  const segments: PromptSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_TOKEN_REGEX.lastIndex = 0;

  while ((match = MENTION_TOKEN_REGEX.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: value.slice(lastIndex, match.index) });
    }
    const parsed = parseMentionToken(match[0]);
    if (parsed) {
      segments.push({
        kind: 'token',
        raw: match[0],
        type: parsed.type,
        label: parsed.label
      });
    } else {
      segments.push({ kind: 'text', text: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ kind: 'text', text: value.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ kind: 'text', text: '' });
  }

  return segments;
};

const getTokenRanges = (text: string) => {
  MENTION_TOKEN_REGEX.lastIndex = 0;
  const ranges: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_TOKEN_REGEX.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
};

const deleteMentionAware = (
  text: string,
  selection: EditorSelection,
  direction: 'backspace' | 'delete'
): { nextValue: string; nextCaret: number } | null => {
  const ranges = getTokenRanges(text);

  if (selection.start !== selection.end) {
    const intersections = ranges.filter((range) => range.end > selection.start && range.start < selection.end);
    if (intersections.length === 0) return null;

    const deleteStart = Math.min(selection.start, intersections[0].start);
    const deleteEnd = Math.max(selection.end, intersections[intersections.length - 1].end);
    return {
      nextValue: `${text.slice(0, deleteStart)}${text.slice(deleteEnd)}`,
      nextCaret: deleteStart
    };
  }

  const caret = selection.start;
  const prevToken = ranges.find((range) => range.end === caret);
  const nextToken = ranges.find((range) => range.start === caret);
  const insideToken = ranges.find((range) => caret > range.start && caret < range.end);

  const token = insideToken || (direction === 'backspace' ? prevToken : nextToken);
  if (!token) return null;

  return {
    nextValue: `${text.slice(0, token.start)}${text.slice(token.end)}`,
    nextCaret: token.start
  };
};

const deleteTextAtSelection = (
  text: string,
  selection: EditorSelection,
  direction: 'backspace' | 'delete'
): { nextValue: string; nextCaret: number } | null => {
  const mentionDeletion = deleteMentionAware(text, selection, direction);
  if (mentionDeletion) return mentionDeletion;

  if (selection.start !== selection.end) {
    return {
      nextValue: `${text.slice(0, selection.start)}${text.slice(selection.end)}`,
      nextCaret: selection.start
    };
  }

  if (direction === 'backspace') {
    if (selection.start <= 0) return null;
    return {
      nextValue: `${text.slice(0, selection.start - 1)}${text.slice(selection.end)}`,
      nextCaret: selection.start - 1
    };
  }

  if (selection.end >= text.length) return null;
  return {
    nextValue: `${text.slice(0, selection.start)}${text.slice(selection.end + 1)}`,
    nextCaret: selection.start
  };
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
  const editorRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const mentionEnabled = characterMentions.length > 0 || productMentions.length > 0;

  const segments = useMemo(() => parseSegments(value), [value]);
  const minHeight = Math.max(rows, 1) * 24 + 16;

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
    characterMentions.forEach((item) => map.set(item.label, item.imageUrl));
    return map;
  }, [characterMentions]);

  const productImageMap = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    productMentions.forEach((item) => map.set(item.label, item.imageUrl));
    return map;
  }, [productMentions]);

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

    setMentionStart(mention.start);
    setMentionQuery(mention.query);
    setMentionOpen(true);
    setActiveIndex(0);
  };

  const commitValue = (nextValue: string, nextCaret?: number) => {
    pendingSelectionRef.current = typeof nextCaret === 'number' ? nextCaret : null;
    onChange(nextValue);
  };

  const syncSelectionAndMention = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = getEditorSelection(editor);
    if (!selection) return;
    updateMentionState(value, selection.end);
  };

  const insertTextAtSelection = (insertedText: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = getEditorSelection(editor) || { start: value.length, end: value.length };
    const nextValue = `${value.slice(0, selection.start)}${insertedText}${value.slice(selection.end)}`;
    const nextCaret = selection.start + insertedText.length;
    commitValue(nextValue, nextCaret);
    updateMentionState(nextValue, nextCaret);
  };

  const insertMention = (item: PromptMentionItem) => {
    if (isItemDisabled(item)) return;
    const editor = editorRef.current;
    if (!editor) return;

    const editorValue = serializeEditorValue(editor);
    const selection = getEditorSelection(editor) || { start: editorValue.length, end: editorValue.length };
    const textBeforeCaret = editorValue.slice(0, selection.end);
    const liveAtIndex = textBeforeCaret.lastIndexOf('@');
    const liveMention = getActiveMentionQuery(editorValue, selection.end);
    const replaceStart = (
      liveAtIndex >= 0
      && (liveAtIndex === 0 || /\s/.test(textBeforeCaret[liveAtIndex - 1] || ''))
      && /^[A-Za-z0-9_-]*$/.test(textBeforeCaret.slice(liveAtIndex + 1))
    )
      ? liveAtIndex
      : (liveMention?.start ?? mentionStart);
    if (replaceStart === null) return;
    const token = buildMentionToken(item);
    const replaceEnd = Math.max(selection.end, replaceStart + 1 + mentionQuery.length);
    const trailingText = editorValue.slice(replaceEnd);
    const needsSpace = trailingText.length === 0 || !/^\s/.test(trailingText);
    const spacer = needsSpace ? ' ' : '';
    const nextValue = `${editorValue.slice(0, replaceStart)}${token}${spacer}${trailingText}`;
    const nextCaret = replaceStart + token.length + spacer.length;
    commitValue(nextValue, nextCaret);
    closeMention();
  };

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (pendingSelectionRef.current === null) return;
    if (document.activeElement !== editor) return;

    setEditorSelection(editor, pendingSelectionRef.current);
    pendingSelectionRef.current = null;
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
    <div ref={rootRef} className="prompt-mention-root relative min-w-0">
      <div
        className={clsx(
          'relative overflow-hidden rounded-lg border bg-white transition-colors',
          hasError ? 'border-red-500 focus-within:border-red-500' : 'border-gray-200 focus-within:border-black',
          readOnly || disabled ? 'bg-gray-50' : ''
        )}
      >
        {!value && placeholder ? (
          <div className="pointer-events-none absolute inset-x-3 top-2 text-sm leading-6 text-gray-400">
            {placeholder}
          </div>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={!disabled && !readOnly}
          suppressContentEditableWarning
          spellCheck={false}
          role="textbox"
          aria-multiline="true"
          onBeforeInput={(event) => {
            if (disabled || readOnly) return;
            if (isComposing || event.nativeEvent.isComposing) return;

            const nativeEvent = event.nativeEvent as InputEvent;
            if (
              nativeEvent.inputType === 'deleteContentBackward'
              || nativeEvent.inputType === 'deleteContentForward'
              || nativeEvent.inputType === 'deleteByCut'
            ) {
              event.preventDefault();
              const editor = editorRef.current;
              if (!editor) return;
              const selection = getEditorSelection(editor) || { start: value.length, end: value.length };
              const deletion = deleteTextAtSelection(
                value,
                selection,
                nativeEvent.inputType === 'deleteContentBackward' ? 'backspace' : 'delete'
              );
              if (!deletion) return;
              commitValue(deletion.nextValue, deletion.nextCaret);
              updateMentionState(deletion.nextValue, deletion.nextCaret);
              return;
            }

            if (nativeEvent.inputType === 'insertText' || nativeEvent.inputType === 'insertReplacementText') {
              event.preventDefault();
              insertTextAtSelection(nativeEvent.data ?? '');
              return;
            }

            if (nativeEvent.inputType === 'insertLineBreak' || nativeEvent.inputType === 'insertParagraph') {
              event.preventDefault();
              insertTextAtSelection('\n');
            }
          }}
          onInput={() => {
            const editor = editorRef.current;
            if (!editor) return;
            if (!isComposing) return;
            const nextValue = serializeEditorValue(editor);
            const selection = getEditorSelection(editor);
            commitValue(nextValue, selection?.end ?? nextValue.length);
            updateMentionState(nextValue, selection?.end ?? nextValue.length);
          }}
          onKeyDown={(event) => {
            if (isComposing || event.nativeEvent.isComposing) return;

            if (mentionOpen && event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((prev) => (prev + 1) % Math.max(flatItems.length, 1));
              return;
            }
            if (mentionOpen && event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((prev) => (prev - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1));
              return;
            }
            if (mentionOpen && event.key === 'Enter') {
              if (flatItems.length > 0) {
                event.preventDefault();
                if (!isItemDisabled(flatItems[activeIndex])) {
                  insertMention(flatItems[activeIndex]);
                }
              }
              return;
            }
            if (mentionOpen && event.key === 'Escape') {
              event.preventDefault();
              closeMention();
              return;
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault();
              const editor = editorRef.current;
              if (!editor) return;
              const selection = getEditorSelection(editor) || { start: value.length, end: value.length };
              const deletion = deleteTextAtSelection(
                value,
                selection,
                event.key === 'Backspace' ? 'backspace' : 'delete'
              );
              if (!deletion) return;
              commitValue(deletion.nextValue, deletion.nextCaret);
              updateMentionState(deletion.nextValue, deletion.nextCaret);
              return;
            }

            if (event.key === 'Enter') {
              event.preventDefault();
              insertTextAtSelection('\n');
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData('text/plain');
            insertTextAtSelection(text);
          }}
          onMouseUp={syncSelectionAndMention}
          onKeyUp={syncSelectionAndMention}
          onClick={syncSelectionAndMention}
          onFocus={() => {
            setIsFocused(true);
            syncSelectionAndMention();
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => {
            setIsComposing(false);
            syncSelectionAndMention();
          }}
          className={clsx(
            'block w-full px-3 py-2 text-sm leading-6 text-[#1f1f1e] whitespace-pre-wrap break-words focus:outline-none',
            preventHorizontalScroll ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto',
            resizable === 'vertical' ? 'resize-y' : 'resize-none',
            readOnly || disabled ? 'cursor-not-allowed bg-gray-50' : '',
            className
          )}
          style={{
            minHeight,
            resize: resizable === 'vertical' ? 'vertical' : 'none'
          }}
        >
          {segments.map((segment, index) => {
            if (segment.kind === 'text') {
              return (
                <span key={`text-${index}`} data-segment-kind="text">
                  {segment.text}
                </span>
              );
            }

            const mentionImage = segment.type === 'character'
              ? characterImageMap.get(segment.label)
              : productImageMap.get(segment.label);

            return (
              <span
                key={`token-${segment.raw}-${index}`}
                contentEditable={false}
                data-token={segment.raw}
                data-token-type={segment.type}
                className="prompt-mention-token inline-flex max-w-full select-none items-center gap-1.5 rounded-lg bg-[#eef2f7] px-2 py-0.5 align-middle text-[#1f1f1e] ring-1 ring-inset ring-[#d4dbe6]"
              >
                <span className="shrink-0 text-[#6b7280]">@</span>
                <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-[#d4dbe6]">
                  {mentionImage ? (
                    <NextImage src={mentionImage} alt={segment.label} fill sizes="16px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[#6b7280]">
                      {segment.type === 'product' ? <ShoppingBag className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    </span>
                  )}
                </span>
                <span className="leading-6" title={segment.label}>
                  {segment.label}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {mentionOpen && (
        <div
          role="listbox"
          className="prompt-mention-menu absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          <div className="max-h-64 space-y-2 overflow-y-auto p-2">
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
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        disabled={isDisabled}
                        data-active={isActive}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (isDisabled) return;
                          insertMention({ id: item.id, label: item.label, type: 'character', imageUrl: item.imageUrl, photoCount: item.photoCount });
                        }}
                        className={clsx(
                          'prompt-mention-option flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
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
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        disabled={isDisabled}
                        data-active={isActive}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (isDisabled) return;
                          insertMention({ id: item.id, label: item.label, type: 'product', imageUrl: item.imageUrl, photoCount: item.photoCount });
                        }}
                        className={clsx(
                          'prompt-mention-option flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
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
