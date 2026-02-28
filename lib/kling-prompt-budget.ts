const MENTION_REGEX = /@(?<type>character|product)\((?<name>[^)]*)\)/g;
const PARTIAL_MENTION_SUFFIX_REGEX = /@(?:character|product)\([^)]*$/;

export const KLING_PROMPT_MAX_CHARS = 500;
export const KLING_PROMPT_SOFT_TARGET = 460;

export type KlingPromptSectionKey =
  | 'action'
  | 'subject'
  | 'dialogue'
  | 'context_environment'
  | 'composition'
  | 'camera_motion_positioning'
  | 'style'
  | 'ambiance_colour_lighting'
  | 'audio';

export type KlingPromptSection = {
  key: KlingPromptSectionKey;
  label: string;
  value: string;
  preserveLabel?: boolean;
};

export type KlingPromptFitInput = {
  sections: KlingPromptSection[];
  tags?: string[];
  replaceMention?: (text: string) => string;
  maxChars?: number;
  softTarget?: number;
};

export type KlingPromptFitResult = {
  finalPrompt: string;
  originalPrompt: string;
  originalLength: number;
  finalLength: number;
  wasCompressed: boolean;
  sectionKeys: KlingPromptSectionKey[];
  tagCount: number;
};

export type KlingPromptEstimateInput = {
  shot: {
    action?: string;
    subject?: string;
    dialogue?: string;
    context_environment?: string;
    composition?: string;
    camera_motion_positioning?: string;
    style?: string;
    ambiance_colour_lighting?: string;
    audio?: string;
  };
};

const SECTION_RENDER_ORDER: KlingPromptSectionKey[] = [
  'subject',
  'action',
  'dialogue',
  'context_environment',
  'composition',
  'camera_motion_positioning',
  'style',
  'ambiance_colour_lighting',
  'audio'
];

const TRUNCATION_PRIORITY: KlingPromptSectionKey[] = [
  'audio',
  'ambiance_colour_lighting',
  'style',
  'camera_motion_positioning',
  'composition',
  'context_environment',
  'dialogue',
  'subject',
  'action'
];

const LABEL_DROP_PRIORITY: KlingPromptSectionKey[] = [
  'audio',
  'ambiance_colour_lighting',
  'style',
  'camera_motion_positioning',
  'composition',
  'context_environment',
  'dialogue',
  'subject'
];

const ACTION_MIN_CHARS = 32;
const SUBJECT_MIN_CHARS = 24;
const DIALOGUE_MIN_CHARS = 24;
const DEFAULT_MIN_CHARS = 12;
const COMPACT_SEPARATOR = '. ';

export class KlingPromptValidationError extends Error {
  readonly code = 'KLING_PROMPT_VALIDATION';

  constructor(message = 'Kling 3.0 prompt exceeds the provider limit after compression. Shorten dialogue or shot details.') {
    super(message);
    this.name = 'KlingPromptValidationError';
  }
}

const cleanPromptText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const truncateKlingField = (value: string, maxChars: number): string => {
  if (maxChars <= 0) return '';
  const normalized = optimizeKlingPromptText(value);
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 3) return normalized.slice(0, maxChars);

  let truncated = normalized.slice(0, maxChars - 3).trim();
  const partialMentionMatch = truncated.match(PARTIAL_MENTION_SUFFIX_REGEX);
  if (partialMentionMatch) {
    truncated = truncated.slice(0, partialMentionMatch.index).trimEnd();
  }
  return truncated.length > 0 ? `${truncated}...` : normalized.slice(0, maxChars);
};

export const optimizeKlingPromptText = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => (
      line
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.;!?])/g, '$1')
        .replace(/\.{2,}/g, '.')
        .trim()
    ))
    .filter(Boolean)
    .join(COMPACT_SEPARATOR)
    .trim();
};

const renderSection = (section: KlingPromptSection, dropLabel: boolean): string => {
  const value = optimizeKlingPromptText(section.value);
  if (!value) return '';
  if (dropLabel && !section.preserveLabel) return value;
  return `${section.label}: ${value}`;
};

const renderPromptBody = (
  sections: KlingPromptSection[],
  dropLabelKeys: Set<KlingPromptSectionKey>
): string => {
  const sectionsByKey = new Map(sections.map(section => [section.key, section]));
  return SECTION_RENDER_ORDER
    .map((key) => {
      const section = sectionsByKey.get(key);
      if (!section) return '';
      return renderSection(section, dropLabelKeys.has(section.key));
    })
    .filter(Boolean)
    .join(COMPACT_SEPARATOR);
};

const normalizeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = cleanPromptText(tag);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

const appendTrailingTags = (basePrompt: string, tags: string[], maxChars: number): string => {
  const optimizedBasePrompt = optimizeKlingPromptText(basePrompt);
  const normalizedTags = normalizeTags(tags);
  if (!normalizedTags.length) {
    return optimizedBasePrompt;
  }

  const trailing = normalizedTags.join(' ');
  if (trailing.length >= maxChars) {
    throw new KlingPromptValidationError();
  }

  if (!optimizedBasePrompt) {
    return trailing;
  }

  return `${optimizedBasePrompt}\n${trailing}`;
};

const getMinCharsForSection = (key: KlingPromptSectionKey): number => {
  switch (key) {
    case 'action':
      return ACTION_MIN_CHARS;
    case 'subject':
      return SUBJECT_MIN_CHARS;
    case 'dialogue':
      return DIALOGUE_MIN_CHARS;
    default:
      return DEFAULT_MIN_CHARS;
  }
};

export const buildKlingPromptSections = ({
  shot
}: KlingPromptEstimateInput): KlingPromptSection[] => {
  const sections: KlingPromptSection[] = [];

  if (cleanPromptText(shot.subject)) {
    sections.push({ key: 'subject', label: 'Subject', value: cleanPromptText(shot.subject) });
  }
  if (cleanPromptText(shot.action)) {
    sections.push({ key: 'action', label: 'Action', value: cleanPromptText(shot.action), preserveLabel: true });
  }
  if (cleanPromptText(shot.dialogue)) {
    sections.push({ key: 'dialogue', label: 'Dialogue', value: cleanPromptText(shot.dialogue) });
  }
  if (cleanPromptText(shot.context_environment)) {
    sections.push({ key: 'context_environment', label: 'Environment', value: cleanPromptText(shot.context_environment) });
  }
  if (cleanPromptText(shot.composition)) {
    sections.push({ key: 'composition', label: 'Composition', value: cleanPromptText(shot.composition) });
  }
  if (cleanPromptText(shot.camera_motion_positioning)) {
    sections.push({ key: 'camera_motion_positioning', label: 'Camera', value: cleanPromptText(shot.camera_motion_positioning) });
  }
  if (cleanPromptText(shot.style)) {
    sections.push({ key: 'style', label: 'Style', value: cleanPromptText(shot.style) });
  }
  if (cleanPromptText(shot.ambiance_colour_lighting)) {
    sections.push({ key: 'ambiance_colour_lighting', label: 'Lighting', value: cleanPromptText(shot.ambiance_colour_lighting) });
  }
  if (cleanPromptText(shot.audio)) {
    sections.push({ key: 'audio', label: 'Audio', value: cleanPromptText(shot.audio) });
  }

  return sections;
};

export const fitKlingPromptWithinLimit = ({
  sections,
  tags = [],
  replaceMention = (text) => text,
  maxChars = KLING_PROMPT_MAX_CHARS,
  softTarget = KLING_PROMPT_SOFT_TARGET
}: KlingPromptFitInput): KlingPromptFitResult => {
  const normalizedSections = sections
    .map(section => ({
      ...section,
      value: cleanPromptText(section.value)
    }))
    .filter(section => section.value.length > 0);
  const dropLabelKeys = new Set<KlingPromptSectionKey>();
  const survivingSections = new Map<KlingPromptSectionKey, KlingPromptSection>(
    normalizedSections.map(section => [section.key, { ...section }])
  );
  const normalizedTags = normalizeTags(tags);

  const buildPrompt = (): string => {
    const body = renderPromptBody(Array.from(survivingSections.values()), dropLabelKeys);
    const replacedBody = optimizeKlingPromptText(replaceMention(body));
    return appendTrailingTags(replacedBody, normalizedTags, maxChars);
  };

  const originalPrompt = buildPrompt();
  if (originalPrompt.length <= softTarget) {
    return {
      finalPrompt: originalPrompt,
      originalPrompt,
      originalLength: originalPrompt.length,
      finalLength: originalPrompt.length,
      wasCompressed: false,
      sectionKeys: Array.from(survivingSections.keys()),
      tagCount: normalizedTags.length
    };
  }

  for (const key of LABEL_DROP_PRIORITY) {
    if (survivingSections.has(key)) {
      dropLabelKeys.add(key);
    }
  }

  let currentPrompt = buildPrompt();
  if (currentPrompt.length <= maxChars) {
    return {
      finalPrompt: currentPrompt,
      originalPrompt,
      originalLength: originalPrompt.length,
      finalLength: currentPrompt.length,
      wasCompressed: true,
      sectionKeys: Array.from(survivingSections.keys()),
      tagCount: normalizedTags.length
    };
  }

  for (const key of TRUNCATION_PRIORITY) {
    const section = survivingSections.get(key);
    if (!section) continue;
    survivingSections.delete(key);
    currentPrompt = buildPrompt();
    if (currentPrompt.length <= softTarget) {
      return {
        finalPrompt: currentPrompt,
        originalPrompt,
        originalLength: originalPrompt.length,
        finalLength: currentPrompt.length,
        wasCompressed: true,
        sectionKeys: Array.from(survivingSections.keys()),
        tagCount: normalizedTags.length
      };
    }
  }

  for (const key of TRUNCATION_PRIORITY.slice().reverse()) {
    const section = normalizedSections.find(item => item.key === key);
    if (!section) continue;

    const bodyWithoutSection = renderPromptBody(
      Array.from(survivingSections.values()).filter(item => item.key !== key),
      dropLabelKeys
    );
    const replacedWithoutSection = optimizeKlingPromptText(replaceMention(bodyWithoutSection));
    const promptWithoutSection = appendTrailingTags(replacedWithoutSection, normalizedTags, maxChars);
    const reservedLength = promptWithoutSection.length;
    const sectionLabel = dropLabelKeys.has(key) && !section.preserveLabel ? '' : `${section.label}: `;
    const separatorLength = bodyWithoutSection ? COMPACT_SEPARATOR.length : 0;
    const availableChars = maxChars - reservedLength - separatorLength - sectionLabel.length;
    const minChars = getMinCharsForSection(key);

    if (availableChars < minChars) {
      continue;
    }

    survivingSections.set(key, {
      ...section,
      value: truncateKlingField(section.value, availableChars)
    });
    currentPrompt = buildPrompt();
    if (currentPrompt.length <= maxChars) {
      return {
        finalPrompt: currentPrompt,
        originalPrompt,
        originalLength: originalPrompt.length,
        finalLength: currentPrompt.length,
        wasCompressed: true,
        sectionKeys: Array.from(survivingSections.keys()),
        tagCount: normalizedTags.length
      };
    }
    survivingSections.delete(key);
  }

  currentPrompt = buildPrompt();
  if (currentPrompt.length <= maxChars) {
    return {
      finalPrompt: currentPrompt,
      originalPrompt,
      originalLength: originalPrompt.length,
      finalLength: currentPrompt.length,
      wasCompressed: true,
      sectionKeys: Array.from(survivingSections.keys()),
      tagCount: normalizedTags.length
    };
  }

  throw new KlingPromptValidationError();
};

const slugifyMentionName = (value: string): string => (
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18) || 'asset'
);

const buildEstimateTokenMap = (texts: string[]): Record<string, string> => {
  const map: Record<string, string> = {};
  let counter = 1;

  for (const text of texts) {
    for (const match of text.matchAll(MENTION_REGEX)) {
      const type = match.groups?.type;
      const name = cleanPromptText(match.groups?.name);
      if (!type || !name) continue;
      const key = `${type}:${name.toLowerCase()}`;
      if (map[key]) continue;
      map[key] = `element_${slugifyMentionName(name)}_${counter.toString(36)}`;
      counter += 1;
    }
  }

  return map;
};

const replaceMentionsForEstimate = (text: string, tokenMap: Record<string, string>): string => (
  text.replace(MENTION_REGEX, (_match, type: string, name: string) => {
    const key = `${type}:${String(name || '').trim().toLowerCase()}`;
    return tokenMap[key] ? `@${tokenMap[key]}` : String(name || '').trim();
  })
);

const collectEstimateTags = (texts: string[], tokenMap: Record<string, string>): string[] => {
  const tags: string[] = [];

  for (const text of texts) {
    for (const match of text.matchAll(MENTION_REGEX)) {
      const type = match.groups?.type;
      const name = cleanPromptText(match.groups?.name);
      if (!type || !name) continue;
      const mapped = tokenMap[`${type}:${name.toLowerCase()}`];
      if (mapped) {
        tags.push(`@${mapped}`);
      }
    }
  }

  return normalizeTags(tags);
};

export const estimateKlingPromptUsage = (input: KlingPromptEstimateInput): KlingPromptFitResult => {
  const sections = buildKlingPromptSections(input);
  const sourceTexts = [
    ...sections.map(section => section.value)
  ].filter(Boolean);
  const tokenMap = buildEstimateTokenMap(sourceTexts);
  const tags = collectEstimateTags(sourceTexts, tokenMap);

  return fitKlingPromptWithinLimit({
    sections,
    tags,
    replaceMention: (text) => replaceMentionsForEstimate(text, tokenMap)
  });
};

export const isKlingPromptValidationError = (error: unknown): error is KlingPromptValidationError => (
  error instanceof KlingPromptValidationError ||
  (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'KLING_PROMPT_VALIDATION'
  )
);
