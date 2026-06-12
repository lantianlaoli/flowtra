const ORIGINAL_PRODUCT_PATTERNS = [
  /\bthree\s+different\s+colou?red\s+goli\s+gumm(?:y|ies)\s+bottles?\b/gi,
  /\bthree\s+goli\s+gumm(?:y|ies)\s+bottles?\b/gi,
  /\bgoli\s+nutrition\s+gumm(?:y|ies)(?:\s+bottles?)?\b/gi,
  /\bgoli\s+gumm(?:y|ies)\s+bottles?\b/gi,
  /\bgoli\s+gumm(?:y|ies)\b/gi,
  /\bthree\s+different\s+colou?red\s+bottles?\b/gi,
  /\bthree\s+bottles?\b/gi,
];

const ORIGINAL_AVATAR_PATTERNS = [
  /\bAfrican\s+American\s+man\b/gi,
  /\bAfrican\s+American\s+male\b/gi,
  /\bBlack\s+man\b/gi,
  /\bBlack\s+male\b/gi,
  /\bthe\s+man\b/gi,
  /\ba\s+man\b/gi,
  /\bman\b/gi,
  /\bmale\b/gi,
  /\bpresenter\b/gi,
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanupReplacementText = (text: string) => (
  text
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(a|an)\s+@product\(/gi, '@product(')
    .trim()
);

export function removeOriginalProductReferences(input: {
  text: string;
  productName?: string | null;
  productToken?: string | null;
}) {
  const productToken = input.productToken?.trim() || input.productName?.trim() || '';
  const source = input.text.trim();
  if (!source || !productToken) return source;
  if (source.includes(productToken)) return source;

  let cleaned = source;
  for (const pattern of ORIGINAL_PRODUCT_PATTERNS) {
    cleaned = cleaned.replace(pattern, productToken);
  }

  return cleanupReplacementText(cleaned);
}

export function removeOriginalAvatarReferences(input: {
  text: string;
  avatarName?: string | null;
  avatarToken?: string | null;
}) {
  const avatarReplacement = input.avatarToken?.trim() || input.avatarName?.trim() || '';
  const source = input.text.trim();
  if (!source || !avatarReplacement) return source;
  if (source.includes(avatarReplacement)) return source;

  let cleaned = source;
  for (const pattern of ORIGINAL_AVATAR_PATTERNS) {
    cleaned = cleaned.replace(pattern, avatarReplacement);
  }
  cleaned = cleaned.replace(
    new RegExp(`\\b(?:a|an)\\s+${escapeRegExp(avatarReplacement)}\\b`, 'gi'),
    avatarReplacement
  );

  return cleanupReplacementText(cleaned);
}

export const __test__ = {
  ORIGINAL_AVATAR_PATTERNS,
  ORIGINAL_PRODUCT_PATTERNS,
  cleanupReplacementText
};
