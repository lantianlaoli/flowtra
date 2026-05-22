'use client';

import { trackEvent } from '@/lib/analytics/client';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

export type LandingToolClickSurface =
  | 'landing_header_desktop_tools'
  | 'landing_header_mobile_tools'
  | 'landing_footer_tools'
  | 'tools_index_card';

const TOOL_FEATURE_BY_HREF: Record<string, string> = {
  '/tools/upload-assets': 'upload_assets',
  '/tools/roas-calculator': 'roas_calculator',
  '/tools/ai-angle-generator': 'ai_angle_generator',
  '/tools/image-clone': 'image_clone',
  '/tools/ecommerce-listing-studio': 'ecommerce_listing_studio',
};

export function trackLandingToolClick(
  href: string,
  surface: LandingToolClickSurface
) {
  const feature = TOOL_FEATURE_BY_HREF[href];
  if (!feature) return;

  trackEvent(ANALYTICS_EVENTS.landing_tool_clicked, {
    surface,
    feature,
    route: typeof window === 'undefined' ? undefined : window.location.pathname,
    target_href: href,
  });
}
