import { PostHog } from 'posthog-node';
import type { NextRequest } from 'next/server';
import type { AnalyticsEventName } from '@/lib/analytics/events';
import {
  buildCommonProperties,
  sanitizeAnalyticsProperties,
  type CommonAnalyticsProperties,
} from '@/lib/analytics/properties';
import { isPostHogEnabled } from '@/lib/analytics/posthog-env';

let posthogServerClient: PostHog | null = null;

export function getPostHogServerClient(): PostHog {
  if (!posthogServerClient) {
    if (!isPostHogEnabled()) {
      throw new Error('PostHog is not enabled');
    }

    posthogServerClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogServerClient;
}

export function captureServerEvent(
  event: AnalyticsEventName,
  {
    distinctId,
    properties,
    request,
  }: {
    distinctId?: string | null;
    properties?: CommonAnalyticsProperties;
    request?: NextRequest | Request | null;
  } = {}
) {
  if (!isPostHogEnabled()) {
    return;
  }

  try {
    const posthog = getPostHogServerClient();
    posthog.capture({
      distinctId: distinctId || 'anonymous',
      event,
      properties: buildCommonProperties({
        ...properties,
        ...buildRequestProperties(request),
      }),
    });
    void posthog.flush();
  } catch (error) {
    console.error('[Analytics] Failed to capture server event:', error);
  }
}

export function captureServerException(
  error: Error,
  distinctId?: string,
  properties?: Record<string, unknown>
) {
  if (!isPostHogEnabled()) {
    return;
  }

  try {
    const posthog = getPostHogServerClient();
    posthog.capture({
      distinctId: distinctId || 'anonymous',
      event: '$exception',
      properties: sanitizeAnalyticsProperties({
        $exception_message: error.message,
        $exception_type: error.name,
        $exception_stack_trace: error.stack,
        $exception_level: 'error',
        ...(properties as Record<string, string | number | boolean | null | undefined>),
      }),
    });
    void posthog.flush();
  } catch (captureError) {
    console.error('Failed to capture exception to PostHog:', captureError);
  }
}

function buildRequestProperties(
  request?: NextRequest | Request | null
): CommonAnalyticsProperties {
  if (!request) {
    return {};
  }

  let url: URL | null = null;
  try {
    url = new URL(request.url);
  } catch {
    url = null;
  }

  return sanitizeAnalyticsProperties({
    route: url?.pathname,
    request_method: request.method,
    referrer_domain: request.headers.get('referer')
      ? safeDomainFromUrl(request.headers.get('referer'))
      : undefined,
    user_agent: request.headers.get('user-agent') || undefined,
  });
}

function safeDomainFromUrl(rawUrl: string | null) {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return undefined;
  }
}

export async function shutdownPostHog() {
  if (posthogServerClient) {
    await posthogServerClient.shutdown();
    posthogServerClient = null;
  }
}
