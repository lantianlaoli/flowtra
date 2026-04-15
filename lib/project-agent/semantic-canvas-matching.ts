const normalizeSemanticLabel = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

type BaseMatchInput<T> = {
  names: string[];
  getKey: (candidate: T) => string;
  getLabels: (candidate: T) => Array<string | null | undefined>;
};

export type SemanticCandidateMatchResult<T> = {
  match: T | null;
  ambiguous: boolean;
};

const filterMatchingCandidates = <T,>(
  name: string,
  candidates: T[],
  getLabels: (candidate: T) => Array<string | null | undefined>,
  matchesAssetReference: (needle: string, haystack: string) => boolean,
) => (
  candidates.filter((candidate) => (
    getLabels(candidate).some((label) => (
      typeof label === 'string' &&
      label.trim().length > 0 &&
      matchesAssetReference(name, label)
    ))
  ))
);

export const resolveSemanticNamedCandidate = <T,>(input: BaseMatchInput<T> & {
  candidates: T[];
  matchesAssetReference: (needle: string, haystack: string) => boolean;
}): SemanticCandidateMatchResult<T> => {
  if (input.names.length === 0) {
    return { match: null, ambiguous: false };
  }

  const matchedCandidates = new Map<string, T>();

  for (const name of input.names) {
    const matches = filterMatchingCandidates(name, input.candidates, input.getLabels, input.matchesAssetReference);

    if (matches.length > 1) {
      return { match: null, ambiguous: true };
    }

    if (matches.length === 1) {
      matchedCandidates.set(input.getKey(matches[0]), matches[0]);
    }
  }

  if (matchedCandidates.size > 1) {
    return { match: null, ambiguous: true };
  }

  return {
    match: matchedCandidates.values().next().value ?? null,
    ambiguous: false,
  };
};

const CANONICAL_SYSTEM_AVATAR_NAMES = new Set([
  'ethan walker',
  'lin yuqing',
]);

export const resolveSemanticAvatarCandidate = <T,>(input: BaseMatchInput<T> & {
  userCandidates: T[];
  systemCandidates: T[];
  matchesAssetReference: (needle: string, haystack: string) => boolean;
}): SemanticCandidateMatchResult<T> => {
  if (input.names.length === 0) {
    return { match: null, ambiguous: false };
  }

  const matchedCandidates = new Map<string, T>();

  for (const name of input.names) {
    const normalizedName = normalizeSemanticLabel(name);
    const userMatches = filterMatchingCandidates(name, input.userCandidates, input.getLabels, input.matchesAssetReference);
    const systemMatches = filterMatchingCandidates(name, input.systemCandidates, input.getLabels, input.matchesAssetReference);

    const prefersSystemDefault = CANONICAL_SYSTEM_AVATAR_NAMES.has(normalizedName);

    if (prefersSystemDefault) {
      if (systemMatches.length > 1) {
        return { match: null, ambiguous: true };
      }
      if (systemMatches.length === 1) {
        matchedCandidates.set(input.getKey(systemMatches[0]), systemMatches[0]);
        continue;
      }
    }

    if (userMatches.length > 1 || systemMatches.length > 1) {
      return { match: null, ambiguous: true };
    }

    if (userMatches.length === 1) {
      matchedCandidates.set(input.getKey(userMatches[0]), userMatches[0]);
      continue;
    }

    if (systemMatches.length === 1) {
      matchedCandidates.set(input.getKey(systemMatches[0]), systemMatches[0]);
    }
  }

  if (matchedCandidates.size > 1) {
    return { match: null, ambiguous: true };
  }

  return {
    match: matchedCandidates.values().next().value ?? null,
    ambiguous: false,
  };
};
