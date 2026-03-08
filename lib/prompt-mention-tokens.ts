export type MentionTokenType = 'character' | 'product';

export const MENTION_TOKEN_REGEX = /@(?:(?:character|product)|(?:c|p))\([^)]*\)/g;
export const MENTION_TOKEN_PARSE_REGEX = /^@(?:(character|product)|(c|p))\(([^)]*)\)\s*$/;
export const PARTIAL_MENTION_TOKEN_SUFFIX_REGEX = /@(?:(?:character|product)|(?:c|p))\([^)]*$/;

export const buildMentionToken = (input: { type: MentionTokenType; label: string }) => (
  input.type === 'character' ? `@c(${input.label})` : `@p(${input.label})`
);

export const parseMentionToken = (tokenText: string): { type: MentionTokenType; label: string } | null => {
  const match = tokenText.match(MENTION_TOKEN_PARSE_REGEX);
  if (!match) return null;

  const longType = match[1];
  const shortType = match[2];
  const label = match[3] || '';
  const type = longType || (shortType === 'c' ? 'character' : shortType === 'p' ? 'product' : '');

  if (type !== 'character' && type !== 'product') {
    return null;
  }

  return {
    type,
    label
  };
};
