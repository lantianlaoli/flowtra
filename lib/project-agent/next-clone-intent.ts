export type CloneCompletionSnapshot = {
  phase?: string | null;
  mergedVideoUrl?: string | null;
};

export type NextCloneFollowupDecision =
  | 'reset'
  | 'clarify-finished'
  | 'clarify-in-progress'
  | 'none';

const DIRECT_NEXT_CLONE_PATTERNS = [
  /^(?:please\s+)?clone\s+(?:another|a new|new|next)\s+video\b/i,
  /^(?:please\s+)?start\s+(?:the\s+)?next\s+clone\b/i,
  /^(?:please\s+)?next\s+clone\b/i,
  /^(?:please\s+)?show(?:\s+me)?\s+more\s+reference\s+videos\b/i,
  /^(?:please\s+)?show(?:\s+me)?\s+(?:another|a new|new|next)\s+reference\s+videos?\b/i,
  /^(?:please\s+)?find(?:\s+me)?\s+another\s+viral\s+video\s+to\s+clone\b/i,
  /^(?:please\s+)?find(?:\s+me)?\s+(?:another|a new|new|next)\s+video\s+to\s+clone\b/i,
  /^(?:please\s+)?let'?s\s+clone\s+(?:another|a new|new|next)\s+video\b/i,
];

const EXCLUDED_NEXT_CLONE_PATTERNS = [
  /^(?:please\s+)?download(?:\s+it)?[.!?]*$/i,
  /^(?:please\s+)?open\s+my\s+ads[.!?]*$/i,
  /^(?:please\s+)?show\s+(?:me\s+)?the\s+final\s+video[.!?]*$/i,
  /^(?:please\s+)?regenerate\s+scene(?:\s+\d+)?[.!?]*$/i,
  /^(?:please\s+)?create\s+final\s+video[.!?]*$/i,
  /^(?:please\s+)?try\s+again[.!?]*$/i,
  /^(?:please\s+)?do\s+it\s+again[.!?]*$/i,
  /^(?:please\s+)?another\s+one[.!?]*$/i,
  /^(?:please\s+)?next[.!?]*$/i,
];

const AMBIGUOUS_FOLLOWUP_PATTERNS = [
  /^(?:please\s+)?again\b/i,
  /^(?:please\s+)?another\s+one\b/i,
  /^(?:please\s+)?next\b/i,
  /^(?:please\s+)?try\s+another\b/i,
  /^(?:please\s+)?do\s+it\s+again\b/i,
  /^(?:please\s+)?try\s+again\b/i,
];

export const getNextCloneCanonicalGuidance = () =>
  'If you want to clone another video, say "clone another video" or "show more reference videos".';

export const getNextCloneClarificationReply = (decision: Exclude<NextCloneFollowupDecision, 'reset' | 'none'>) => {
  if (decision === 'clarify-finished') {
    return 'Do you want to start a new clone or keep reviewing this finished video? If you want a new one, say "clone another video" or "show more reference videos".';
  }

  return 'Your current clone is still in progress. Do you want to keep working on this one, or start a brand-new clone after it finishes?';
};

export const isCloneFlowEffectivelyFinished = (snapshot: CloneCompletionSnapshot | null | undefined) => {
  if (!snapshot) return false;
  if (typeof snapshot.mergedVideoUrl === 'string' && snapshot.mergedVideoUrl.trim().length > 0) {
    return true;
  }

  return snapshot.phase === 'merging' || snapshot.phase === 'completed';
};

export const isNextCloneIntentMessage = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  if (EXCLUDED_NEXT_CLONE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return DIRECT_NEXT_CLONE_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const isAmbiguousNextCloneFollowup = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return AMBIGUOUS_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const decideNextCloneFollowup = (text: string, snapshot: CloneCompletionSnapshot | null | undefined): NextCloneFollowupDecision => {
  const finished = isCloneFlowEffectivelyFinished(snapshot);
  if (isNextCloneIntentMessage(text)) {
    return finished ? 'reset' : 'clarify-in-progress';
  }

  if (finished && isAmbiguousNextCloneFollowup(text)) {
    return 'clarify-finished';
  }

  return 'none';
};
