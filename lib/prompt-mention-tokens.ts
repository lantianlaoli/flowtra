export type MentionTokenType = 'character' | 'product';
export type ParsedMentionTokenType = MentionTokenType | 'unknown';

export type ParsedMentionToken = {
  type: ParsedMentionTokenType;
  label: string;
  key: string;
  syntax: 'plain' | 'typed';
};

const MENTION_PLAIN_NAME_PATTERN = '[a-z0-9][a-z0-9_-]*';

export const normalizeMentionLabel = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
);

export const MENTION_TOKEN_REGEX = new RegExp(
  `(?<![A-Za-z0-9_])@(?:(?:character|product|c|p)\\([^)]*\\)|${MENTION_PLAIN_NAME_PATTERN})`,
  'g'
);
export const MENTION_TOKEN_PARSE_REGEX = new RegExp(
  `^(?:@(?:(character|product)|(c|p))\\(([^)]*)\\)|@(${MENTION_PLAIN_NAME_PATTERN}))\\s*$`
);
export const PARTIAL_MENTION_TOKEN_SUFFIX_REGEX = new RegExp(
  `@(?:(?:character|product|c|p)\\([^)]*$|${MENTION_PLAIN_NAME_PATTERN}$)`
);

export const buildMentionToken = (input: { type: MentionTokenType; label: string }) => {
  const normalized = normalizeMentionLabel(input.label);
  return normalized ? `@${normalized}` : '@asset';
};

export const parseMentionToken = (tokenText: string): ParsedMentionToken | null => {
  const match = tokenText.match(MENTION_TOKEN_PARSE_REGEX);
  if (!match) return null;

  const longType = match[1];
  const shortType = match[2];
  const typedLabel = match[3] || '';
  const plainLabel = match[4] || '';
  const typedType = longType || (shortType === 'c' ? 'character' : shortType === 'p' ? 'product' : '');

  if (typedType === 'character' || typedType === 'product') {
    return {
      type: typedType,
      label: typedLabel,
      key: normalizeMentionLabel(typedLabel),
      syntax: 'typed'
    };
  }

  if (!plainLabel) {
    return null;
  }

  return {
    type: 'unknown',
    label: plainLabel,
    key: normalizeMentionLabel(plainLabel),
    syntax: 'plain'
  };
};
