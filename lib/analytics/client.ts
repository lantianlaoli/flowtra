'use client';

import posthog from 'posthog-js';
import type { AnalyticsEventName } from '@/lib/analytics/events';
import {
  buildCommonProperties,
  type CommonAnalyticsProperties,
} from '@/lib/analytics/properties';

export function isPostHogClientAvailable() {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function trackEvent(
  event: AnalyticsEventName,
  properties?: CommonAnalyticsProperties
) {
  if (!isPostHogClientAvailable()) {
    return;
  }

  try {
    posthog.capture(event, buildCommonProperties(properties));
  } catch (error) {
    console.error('[Analytics] Failed to capture client event:', error);
  }
}

export function identifyUser(
  distinctId: string,
  properties?: Record<string, string | undefined>
) {
  if (!isPostHogClientAvailable()) {
    return;
  }

  try {
    posthog.identify(distinctId, sanitizeIdentifyProperties(properties));
  } catch (error) {
    console.error('[Analytics] Failed to identify user:', error);
  }
}

function sanitizeIdentifyProperties(
  properties?: Record<string, string | undefined>
) {
  return Object.fromEntries(
    Object.entries(properties || {}).flatMap(([key, value]) =>
      typeof value === 'string' && value.trim().length > 0 ? [[key, value]] : []
    )
  );
}
