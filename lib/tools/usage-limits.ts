export type ToolUsageKey = 'ai-angle-generator' | 'image-clone' | 'ad-short-film' | 'ecommerce-listing-studio';

type ToolUsageRecord = {
  date: string;
  count: number;
};

const STORAGE_PREFIX = 'flowtra_tool_usage:v1';
const IMAGE_DAILY_LIMIT = 3;
const VIDEO_DAILY_LIMIT = 1;

const TOOL_LIMITS: Record<ToolUsageKey, number> = {
  'ai-angle-generator': IMAGE_DAILY_LIMIT,
  'image-clone': IMAGE_DAILY_LIMIT,
  'ad-short-film': VIDEO_DAILY_LIMIT,
  'ecommerce-listing-studio': VIDEO_DAILY_LIMIT,
};

export const TOOL_LIMIT_MESSAGES: Record<ToolUsageKey, string> = {
  'ai-angle-generator': 'Daily image generation limit reached (3/day). Try again tomorrow.',
  'image-clone': 'Daily image generation limit reached (3/day). Try again tomorrow.',
  'ad-short-film': 'Daily video generation limit reached (1/day). Try again tomorrow.',
  'ecommerce-listing-studio': 'Daily ecommerce listing generation limit reached (1/day). Try again tomorrow.',
};

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStorageKey(toolKey: ToolUsageKey) {
  return `${STORAGE_PREFIX}:${toolKey}`;
}

function normalizeRecord(value: unknown): ToolUsageRecord {
  const today = getTodayKey();

  if (!value || typeof value !== 'object') {
    return { date: today, count: 0 };
  }

  const record = value as Partial<ToolUsageRecord>;
  if (record.date !== today || typeof record.count !== 'number' || !Number.isFinite(record.count)) {
    return { date: today, count: 0 };
  }

  return {
    date: today,
    count: Math.max(0, Math.floor(record.count)),
  };
}

export function getToolUsage(toolKey: ToolUsageKey): ToolUsageRecord {
  if (typeof window === 'undefined') {
    return { date: getTodayKey(), count: 0 };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(toolKey));
    const record = normalizeRecord(raw ? JSON.parse(raw) : null);
    window.localStorage.setItem(getStorageKey(toolKey), JSON.stringify(record));
    return record;
  } catch {
    return { date: getTodayKey(), count: 0 };
  }
}

export function canUseToolToday(toolKey: ToolUsageKey) {
  return getToolUsage(toolKey).count < TOOL_LIMITS[toolKey];
}

export function canUseTool(toolKey: ToolUsageKey, options?: { hasUnlimitedAccess?: boolean }) {
  if (options?.hasUnlimitedAccess) return true;
  return canUseToolToday(toolKey);
}

export function incrementToolUsage(toolKey: ToolUsageKey) {
  if (typeof window === 'undefined') return getToolUsage(toolKey);

  const current = getToolUsage(toolKey);
  const next = {
    ...current,
    count: current.count + 1,
  };

  try {
    window.localStorage.setItem(getStorageKey(toolKey), JSON.stringify(next));
  } catch {
    // localStorage failures should not break a completed generation request.
  }

  return next;
}

export function incrementLimitedToolUsage(
  toolKey: ToolUsageKey,
  options?: { hasUnlimitedAccess?: boolean }
) {
  if (options?.hasUnlimitedAccess) return getToolUsage(toolKey);
  return incrementToolUsage(toolKey);
}
