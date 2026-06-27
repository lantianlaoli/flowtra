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
  // Clothing/footwear color descriptors that reveal the source identity
  /\bpink\s+sweatpants?\b/gi,
  /\bsweatpants?\b/gi,
  /\bblack-and-white\s+(?:Nike|sneaker|slides?|shoes?)\b/gi,
  /\b(?:Nike|Adidas|Puma|Reebok|Converse|Vans|New\s+Balance)\s+(?:sneakers?|slides?|shoes?|socks?)\b/gi,
  /\bslides?\b/gi,
  /\bsneakers?\b/gi,
  /\bshoes?\b/gi,
  /\bsocks?\b/gi,
  /\bin\s+pink\b/gi,
  /\bwearing\s+pink\b/gi,
  // Identity anchors
  /\bAfrican\s+American\s+man\b/gi,
  /\bAfrican\s+American\s+male\b/gi,
  /\bBlack\s+man\b/gi,
  /\bBlack\s+male\b/gi,
  /\bthe\s+man\b/gi,
  /\ba\s+man\b/gi,
  /\bman\b/gi,
  /\bmale\b/gi,
  /\bthe\s+woman\b/gi,
  /\ba\s+woman\b/gi,
  /\bwoman\b/gi,
  /\bthe\s+girl\b/gi,
  /\ba\s+girl\b/gi,
  /\bgirl\b/gi,
  /\bthe\s+boy\b/gi,
  /\ba\s+boy\b/gi,
  /\bboy\b/gi,
  /\bthe\s+person(?:\s+in\s+pink)?\b/gi,
  /\baperson\b/gi,
  /\bfemale\b/gi,
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

const ORIGINAL_PET_PATTERNS = [
  /\btabby\s+cat\b/gi,
  /\btuxedo\s+cat\b/gi,
  /\bcalico\s+cat\b/gi,
  /\bsiamese\s+cat\b/gi,
  /\bpersian\s+cat\b/gi,
  /\bmaine\s+coon\s+cat\b/gi,
  /\bbritish\s+shorthair\s+cat\b/gi,
  /\bragdoll\s+cat\b/gi,
  /\bgolden\s+retriever\s+dog\b/gi,
  /\blabrador\s+retriever\s+dog\b/gi,
  /\bfrench\s+bulldog\b/gi,
  /\bcorgi\s+dog\b/gi,
  /\bborder\s+collie\s+dog\b/gi,
  /\bpomeranian\s+dog\b/gi,
  /\bhusky\s+dog\b/gi,
  /\bstray\s+cat\b/gi,
  /\bstray\s+dog\b/gi,
  /\borange\s+tabby\s+cat\b/gi,
  /\bgray\s+tabby\s+cat\b/gi,
  /\bwhite\s+cat\b/gi,
  /\borange\s+cat\b/gi,
  /\bblack\s+cat\b/gi,
  /\bblack\s+dog\b/gi,
  /\byellow\s+lab\b/gi,
  /\blittle\s+cat\b/gi,
  /\bsmall\s+cat\b/gi,
  /\bkitten\b/gi,
  /\bpuppy\b/gi,
  /\bthe\s+cat\b/gi,
  /\bthe\s+dog\b/gi,
  /\bthe\s+puppy\b/gi,
  /\bthe\s+kitten\b/gi,
  /\bcat\b/gi,
  /\bdog\b/gi,
  /\bpet\b/gi,
  /\banimal\b/gi,
];

export function removeOriginalPetReferences(input: {
  text: string;
  petName?: string | null;
  petToken?: string | null;
}) {
  const petReplacement = input.petToken?.trim() || input.petName?.trim() || '';
  const source = input.text.trim();
  if (!source || !petReplacement) return source;
  if (source.includes(petReplacement)) return source;

  let cleaned = source;
  for (const pattern of ORIGINAL_PET_PATTERNS) {
    cleaned = cleaned.replace(pattern, petReplacement);
  }

  return cleanupReplacementText(cleaned);
}

export const __test__ = {
  ORIGINAL_AVATAR_PATTERNS,
  ORIGINAL_PRODUCT_PATTERNS,
  ORIGINAL_PET_PATTERNS,
  cleanupReplacementText
};
