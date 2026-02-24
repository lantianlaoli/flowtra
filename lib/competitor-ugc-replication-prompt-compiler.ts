import type { VideoModel } from '@/lib/constants';

export type PromptCompileMode = 'kling_elements' | 'plain_text';

const MENTION_REGEX = /@(?<type>character|product)\((?<name>[^)]*)\)/g;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const replaceMentionsForPlainText = (text: string): string => (
  text
    .replace(MENTION_REGEX, (_match, _type: string, name: string) => (name || '').trim())
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
);

const countMentionsInValue = (value: unknown): number => {
  if (typeof value === 'string') {
    return Array.from(value.matchAll(MENTION_REGEX)).length;
  }
  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + countMentionsInValue(item), 0);
  }
  if (isPlainObject(value)) {
    return Object.values(value).reduce<number>((total, item) => total + countMentionsInValue(item), 0);
  }
  return 0;
};

const mapMentionsInValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return replaceMentionsForPlainText(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => mapMentionsInValue(item));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      acc[key] = mapMentionsInValue(entryValue);
      return acc;
    }, {});
  }
  return value;
};

export const compilePromptForExecution = <T>(
  value: T,
  model: VideoModel
): {
  compiledValue: T;
  mentionCount: number;
  compileMode: PromptCompileMode;
} => {
  const mentionCount = countMentionsInValue(value);
  if (model === 'kling_3') {
    return {
      compiledValue: value,
      mentionCount,
      compileMode: 'kling_elements'
    };
  }

  return {
    compiledValue: mapMentionsInValue(value) as T,
    mentionCount,
    compileMode: 'plain_text'
  };
};

export const __test__ = {
  countMentionsInValue
};
