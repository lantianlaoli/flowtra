const ASSET_MATCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'build',
  'by',
  'canvas',
  'clone',
  'context',
  'create',
  'feature',
  'flow',
  'for',
  'from',
  'in',
  'into',
  'keep',
  'node',
  'of',
  'on',
  'or',
  'same',
  'set',
  'that',
  'the',
  'this',
  'up',
  'use',
  'using',
  'video',
  'with',
  'workflow',
]);

export const normalizeAssetNeedle = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeToken = (value: string) => {
  let token = normalizeAssetNeedle(value);
  if (!token) return '';
  if (token.endsWith('ies') && token.length > 4) token = `${token.slice(0, -3)}y`;
  else if (token.endsWith('ing') && token.length > 5) token = token.slice(0, -3);
  else if (token.endsWith('ed') && token.length > 4) token = token.slice(0, -2);
  else if (token.endsWith('s') && token.length > 4) token = token.slice(0, -1);
  return token;
};

const tokenizeAssetNeedle = (value: string) => normalizeAssetNeedle(value)
  .split(' ')
  .map(normalizeToken)
  .filter((token) => token.length >= 3 && !ASSET_MATCH_STOPWORDS.has(token));

const tokensLikelyMatch = (left: string, right: string) => (
  left === right
  || (left.length >= 4 && right.startsWith(left))
  || (right.length >= 4 && left.startsWith(right))
);

export const includesNormalizedAssetName = (haystack: string, needle: string) => {
  const normalizedHaystack = normalizeAssetNeedle(haystack);
  const normalizedNeedle = normalizeAssetNeedle(needle);
  if (!normalizedHaystack || !normalizedNeedle) return false;
  return normalizedHaystack.includes(normalizedNeedle);
};

export const matchesAssetReference = (haystack: string, candidate: string) => {
  if (includesNormalizedAssetName(haystack, candidate)) {
    return true;
  }

  const haystackTokens = tokenizeAssetNeedle(haystack);
  const candidateTokens = tokenizeAssetNeedle(candidate);
  if (haystackTokens.length === 0 || candidateTokens.length === 0) {
    return false;
  }

  const overlap = haystackTokens.filter((haystackToken) => (
    candidateTokens.some((candidateToken) => tokensLikelyMatch(haystackToken, candidateToken))
  ));

  if (overlap.length === 0) return false;
  if (candidateTokens.length === 1 || haystackTokens.length === 1) return overlap.length >= 1;
  return overlap.length >= 2;
};
