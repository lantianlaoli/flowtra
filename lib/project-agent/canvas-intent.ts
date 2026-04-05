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

export const refineCanvasIntent = (intent: CanvasIntent): CanvasIntent => {
  const raw = intent.rawUserRequest.toLowerCase();
  const mentionsMotionClone = /\bmotion clone\b/.test(raw);
  const mentionsAvatarAds = /\bavatar ads?\b|\bcharacter ads?\b/.test(raw);
  const mentionsGenericClone = /\bclone(?:d|s|ing)?\b/.test(raw);

  const hasVideoRef = hasAssetRef(intent, 'video');
  const hasAvatarRef = hasAssetRef(intent, 'avatar') || intent.constraints.keepAvatar === true;
  const hasProductRef = hasAssetRef(intent, 'product') || intent.constraints.keepProduct === true;

  if (
    intent.workflow === 'motion_clone' &&
    !mentionsMotionClone &&
    mentionsGenericClone &&
    hasVideoRef &&
    hasProductRef &&
    !hasAvatarRef
  ) {
    return {
      ...intent,
      workflow: 'video_clone',
    };
  }

  if (
    intent.workflow === 'unknown' &&
    !mentionsMotionClone &&
    !mentionsAvatarAds &&
    mentionsGenericClone &&
    hasVideoRef &&
    (hasProductRef || hasAvatarRef)
  ) {
    return {
      ...intent,
      workflow: 'video_clone',
    };
  }

  return intent;
};
