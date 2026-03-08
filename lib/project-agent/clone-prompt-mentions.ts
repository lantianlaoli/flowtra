import { MENTION_TOKEN_REGEX } from '@/lib/prompt-mention-tokens';

const AVATAR_ROLE_REGEX = /\b(man|male|woman|female|person|character|subject|mother|father|guy|girl|boy|lady)\b/i;
const AVATAR_PRONOUN_REGEX = /\b(he|she|him|his|her)\b/i;
const PRODUCT_GENERIC_REGEX = /\b(product|item|object|toy|book)\b/i;
const PRODUCT_ACTION_HINT_REGEX = /\b(holding|hold|reading|read|using|use|showing|show|presenting|present|carrying|carry)\b/i;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSentenceEnding = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return `${trimmed.replace(/[.。!?！？]+\s*$/, '')}.`;
};

const cleanupPromptGrammar = (text: string) => {
  const withoutLegacySuffix = text
    .replace(/,\s*featuring\s*@(?:character|c)\([^)]*\)\s*interacting\s*with\s*@(?:product|p)\([^)]*\)\.?/gi, '')
    .replace(/,\s*featuring\s*@(?:character|c)\([^)]*\)\.?/gi, '')
    .replace(/,\s*featuring\s*@(?:product|p)\([^)]*\)\.?/gi, '');

  const cleaned = withoutLegacySuffix
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ',')
    .replace(/\b(a|an)\s+,/gi, '$1')
    .trim();

  return normalizeSentenceEnding(cleaned);
};

export const stripMentionTokens = (text: string): string => (
  text
    .replace(MENTION_TOKEN_REGEX, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
);

const replaceFirstMatch = (text: string, pattern: RegExp, replacement: string | ((match: string) => string)) => {
  const match = text.match(pattern);
  if (!match || match.index === undefined) {
    return { text, replaced: false };
  }

  const start = match.index;
  const end = start + match[0].length;
  const nextReplacement = typeof replacement === 'function' ? replacement(match[0]) : replacement;
  return {
    text: `${text.slice(0, start)}${nextReplacement}${text.slice(end)}`,
    replaced: true
  };
};

export const injectMentionsInline = (input: {
  imagePrompt: string;
  fallbackSummary?: string;
  avatarToken?: string | null;
  productToken?: string | null;
  avatarName?: string | null;
  productName?: string | null;
}) => {
  const avatarToken = input.avatarToken || null;
  const productToken = input.productToken || null;

  const basePrompt = stripMentionTokens(input.imagePrompt || '').trim();
  const fallbackPrompt = stripMentionTokens(input.fallbackSummary || '').trim();
  let working = (basePrompt || fallbackPrompt).replace(/\s+/g, ' ').trim();

  if (!working) {
    if (avatarToken && productToken) return `${avatarToken} is in frame, holding ${productToken}.`;
    if (avatarToken) return `${avatarToken} is in frame.`;
    if (productToken) return `${productToken} is in frame.`;
    return '';
  }

  if (avatarToken && !working.includes(avatarToken)) {
    let replaced = false;

    if (input.avatarName?.trim()) {
      const nameRegex = new RegExp(`\\b${escapeRegExp(input.avatarName.trim())}\\b`, 'i');
      const result = replaceFirstMatch(working, nameRegex, avatarToken);
      working = result.text;
      replaced = result.replaced;
    }

    if (!replaced) {
      const result = replaceFirstMatch(working, AVATAR_ROLE_REGEX, avatarToken);
      working = result.text;
      replaced = result.replaced;
    }

    if (!replaced) {
      const result = replaceFirstMatch(working, AVATAR_PRONOUN_REGEX, (match) => {
        const normalized = match.toLowerCase();
        if (normalized === 'his' || normalized === 'her') {
          return `${avatarToken}'s`;
        }
        return avatarToken;
      });
      working = result.text;
      replaced = result.replaced;
    }

    if (!replaced) {
      working = `${avatarToken} is in frame, ${working}`;
    }
  }

  if (productToken && !working.includes(productToken)) {
    let replaced = false;

    if (input.productName?.trim()) {
      const nameRegex = new RegExp(`\\b${escapeRegExp(input.productName.trim())}\\b`, 'i');
      const result = replaceFirstMatch(working, nameRegex, productToken);
      working = result.text;
      replaced = result.replaced;
    }

    if (!replaced) {
      const result = replaceFirstMatch(working, PRODUCT_GENERIC_REGEX, productToken);
      working = result.text;
      replaced = result.replaced;
    }

    if (!replaced) {
      const articlePlaceholderReplaced = working.replace(/\b(a|an)\s*,/i, `$1 ${productToken}`);
      if (articlePlaceholderReplaced !== working) {
        working = articlePlaceholderReplaced;
        replaced = true;
      }
    }

    if (!replaced) {
      const actionResult = replaceFirstMatch(working, PRODUCT_ACTION_HINT_REGEX, (match) => `${match} ${productToken}`);
      working = actionResult.text;
      replaced = actionResult.replaced;
    }

    if (!replaced) {
      const normalized = working.replace(/[.。!?！？]+\s*$/, '').trim();
      working = `${normalized}, holding ${productToken}`;
    }
  }

  return cleanupPromptGrammar(working);
};

export const __test__ = {
  cleanupPromptGrammar,
  replaceFirstMatch
};
