export type AnalyticsPropertyValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue | undefined>;

export interface CommonAnalyticsProperties extends AnalyticsProperties {
  user_id?: string;
  route?: string;
  surface?: string;
  feature?: string;
  project_id?: string;
  workflow?: string;
  video_model?: string;
  duration_seconds?: number;
  aspect_ratio?: string;
  segment_count?: number;
  credits_cost?: number;
  status?: string;
  error_code?: string;
  error_message?: string;
  source_type?: string;
  reference_type?: string;
  download_type?: string;
  is_first_download?: boolean;
}

const MAX_STRING_LENGTH = 400;

function sanitizeValue(
  value: AnalyticsPropertyValue | undefined
): AnalyticsPropertyValue | undefined {
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => {
      if (typeof item === 'string' && item.length > MAX_STRING_LENGTH) {
        return item.slice(0, MAX_STRING_LENGTH);
      }
      return item;
    }) as AnalyticsPropertyValue;
  }
  return value;
}

export function sanitizeAnalyticsProperties<T extends AnalyticsProperties>(properties?: T): T {
  const sanitizedEntries = Object.entries(properties || {}).flatMap(([key, value]) => {
    const sanitizedValue = sanitizeValue(value);
    return sanitizedValue === undefined ? [] : [[key, sanitizedValue]];
  });
  return Object.fromEntries(sanitizedEntries) as T;
}

export function buildCommonProperties(
  properties?: CommonAnalyticsProperties
): CommonAnalyticsProperties {
  return sanitizeAnalyticsProperties({
    environment: process.env.NODE_ENV,
    ...properties,
  });
}
