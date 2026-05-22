import { matchesAssetReference } from '@/lib/project-agent/asset-name-match';

export type CanvasIntentWorkflow = 'motion_clone' | 'video_clone' | 'avatar_ads' | 'unknown';

export type CanvasIntentOperation =
  | 'build_workflow'
  | 'execute_workflow'
  | 'inspect_canvas'
  | 'format_layout'
  | 'delete_selection'
  | 'clear_canvas'
  | 'none';

export type CanvasIntentAssetType = 'video' | 'avatar' | 'product' | 'text';

export type CanvasIntentAssetRef = {
  type: CanvasIntentAssetType;
  value?: string;
  mode: 'named' | 'current_context';
};

export type CanvasIntentConstraints = {
  keepProduct?: boolean;
  keepAvatar?: boolean;
  removeProduct?: boolean;
  removeAvatar?: boolean;
  avoidWorkflow?: CanvasIntentWorkflow | null;
};

export type CanvasIntent = {
  workflow: CanvasIntentWorkflow;
  operation: CanvasIntentOperation;
  assetRefs: CanvasIntentAssetRef[];
  constraints: CanvasIntentConstraints;
  executionMode: 'build_only' | 'execute';
  replyLanguage: string;
  nextRequiredSelection: CanvasIntentAssetType | null;
  confidence: number;
  rawUserRequest: string;
};

const WORKFLOWS = new Set<CanvasIntentWorkflow>(['motion_clone', 'video_clone', 'avatar_ads', 'unknown']);
const OPERATIONS = new Set<CanvasIntentOperation>([
  'build_workflow',
  'execute_workflow',
  'inspect_canvas',
  'format_layout',
  'delete_selection',
  'clear_canvas',
  'none',
]);
const ASSET_TYPES = new Set<CanvasIntentAssetType>(['video', 'avatar', 'product', 'text']);

export const normalizeCanvasReplyLanguage = (value: unknown, fallback = 'en') => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'same_as_user') return fallback;
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('pt')) return 'pt';
  return normalized;
};

const normalizeWorkflow = (value: unknown): CanvasIntentWorkflow => (
  typeof value === 'string' && WORKFLOWS.has(value as CanvasIntentWorkflow)
    ? value as CanvasIntentWorkflow
    : 'unknown'
);

const normalizeOperation = (value: unknown): CanvasIntentOperation => (
  typeof value === 'string' && OPERATIONS.has(value as CanvasIntentOperation)
    ? value as CanvasIntentOperation
    : 'none'
);

const normalizeAssetRefs = (value: unknown): CanvasIntentAssetRef[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const type = typeof record.type === 'string' && ASSET_TYPES.has(record.type as CanvasIntentAssetType)
      ? record.type as CanvasIntentAssetType
      : null;
    if (!type) return [];

    const rawMode = typeof record.mode === 'string' ? record.mode : 'named';
    const mode = rawMode === 'current_context' ? 'current_context' : 'named';
    const rawValue = typeof record.value === 'string'
      ? record.value.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : '';

    return [{
      type,
      mode,
      ...(rawValue ? { value: rawValue } : {}),
    }];
  });
};

export const normalizeCanvasIntent = (input: {
  raw: Record<string, unknown> | null;
  rawUserRequest: string;
  fallbackLanguage?: string;
}): CanvasIntent | null => {
  if (!input.raw) return null;

  const rawConfidence = input.raw.confidence;
  const confidence = typeof rawConfidence === 'number'
    ? rawConfidence
    : Number(rawConfidence);

  const nextRequiredSelection = (
    typeof input.raw.nextRequiredSelection === 'string' &&
    ASSET_TYPES.has(input.raw.nextRequiredSelection as CanvasIntentAssetType)
  )
    ? input.raw.nextRequiredSelection as CanvasIntentAssetType
    : null;

  const constraintsRecord = input.raw.constraints && typeof input.raw.constraints === 'object'
    ? input.raw.constraints as Record<string, unknown>
    : {};

  const executionMode = input.raw.executionMode === 'execute' ? 'execute' : 'build_only';

  return {
    workflow: normalizeWorkflow(input.raw.workflow),
    operation: normalizeOperation(input.raw.operation),
    assetRefs: normalizeAssetRefs(input.raw.assetRefs),
    constraints: {
      keepProduct: constraintsRecord.keepProduct === true,
      keepAvatar: constraintsRecord.keepAvatar === true,
      removeProduct: constraintsRecord.removeProduct === true,
      removeAvatar: constraintsRecord.removeAvatar === true,
      avoidWorkflow: normalizeWorkflow(constraintsRecord.avoidWorkflow),
    },
    executionMode,
    replyLanguage: normalizeCanvasReplyLanguage(input.raw.replyLanguage, input.fallbackLanguage ?? 'en'),
    nextRequiredSelection,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    rawUserRequest: input.rawUserRequest,
  };
};

const hasAssetRef = (intent: CanvasIntent, type: CanvasIntentAssetRef['type']) => (
  intent.assetRefs.some((ref) => ref.type === type)
);

const isLikelyProductForGenericClone = (raw: string, value: string | undefined) => {
  if (!value) return false;
  if (/\b(?:avatar|person|people|model|actor|actress|character|spokesperson|influencer)\b/.test(raw)) {
    return false;
  }
  return new RegExp(`\\bfor\\s+${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}`, 'i').test(raw)
    || matchesAssetReference(raw, value);
};

const extractGenericCloneParts = (raw: string) => {
  if (/\b(?:avatar|person|people|model|actor|actress|character|spokesperson|influencer)\b/.test(raw)) {
    return { videoName: null, productName: null };
  }

  const match = raw.match(/\bclone(?:d|s|ing)?\s+(.+?)\s+for\s+(.+?)(?:[.!?]|$)/i);
  const videoName = match?.[1]?.trim().replace(/^(?:a|an|the)\s+/i, '') || null;
  const productName = match?.[2]?.trim().replace(/^(?:a|an|the)\s+/i, '') || null;
  return {
    videoName: videoName && videoName.length >= 3 ? videoName : null,
    productName: productName && productName.length >= 3 ? productName : null,
  };
};

const normalizeGenericCloneProductRefs = (intent: CanvasIntent, raw: string, mentionsGenericClone: boolean) => {
  if (!mentionsGenericClone || /\bmotion clone\b/.test(raw) || /\bavatar ads?\b|\bcharacter ads?\b/.test(raw)) {
    return intent.assetRefs;
  }

  const normalizedRefs = intent.assetRefs.map((ref) => {
    if (
      ref.type === 'avatar' &&
      ref.mode === 'named' &&
      isLikelyProductForGenericClone(raw, ref.value)
    ) {
      return { ...ref, type: 'product' as const };
    }
    return ref;
  });

  const { videoName: inferredVideoName, productName: inferredProductName } = extractGenericCloneParts(raw);
  const hasVideo = normalizedRefs.some((ref) => ref.type === 'video');
  const hasProduct = normalizedRefs.some((ref) => ref.type === 'product');
  const inferredRefs = [...normalizedRefs];

  if (!hasVideo && inferredVideoName) {
    inferredRefs.push({ type: 'video' as const, value: inferredVideoName, mode: 'named' as const });
  }

  if (!hasProduct && inferredProductName) {
    inferredRefs.push({ type: 'product' as const, value: inferredProductName, mode: 'named' as const });
  }

  return inferredRefs;
};

export const refineCanvasIntent = (intent: CanvasIntent): CanvasIntent => {
  const raw = intent.rawUserRequest.toLowerCase();
  const mentionsMotionClone = /\bmotion clone\b/.test(raw);
  const mentionsAvatarAds = /\bavatar ads?\b|\bcharacter ads?\b/.test(raw);
  const mentionsGenericClone = /\bclone(?:d|s|ing)?\b/.test(raw);

  const assetRefs = normalizeGenericCloneProductRefs(intent, raw, mentionsGenericClone);
  const normalizedIntent = assetRefs === intent.assetRefs ? intent : { ...intent, assetRefs };

  const hasNormalizedAssetRef = (type: CanvasIntentAssetRef['type']) => (
    assetRefs.some((ref) => ref.type === type)
  );

  const hasVideoRef = hasNormalizedAssetRef('video');
  const hasAvatarRef = hasNormalizedAssetRef('avatar') || normalizedIntent.constraints.keepAvatar === true;
  const hasProductRef = hasNormalizedAssetRef('product') || normalizedIntent.constraints.keepProduct === true;

  if (
    (intent.workflow === 'motion_clone' || intent.workflow === 'unknown' || intent.workflow === 'avatar_ads') &&
    !mentionsMotionClone &&
    !mentionsAvatarAds &&
    mentionsGenericClone &&
    hasVideoRef &&
    (hasProductRef || hasAvatarRef) &&
    (hasProductRef || intent.workflow !== 'motion_clone' || !hasAvatarRef)
  ) {
    return {
      ...normalizedIntent,
      workflow: 'video_clone',
    };
  }

  return normalizedIntent;
};
