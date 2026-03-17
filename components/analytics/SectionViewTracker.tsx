'use client';

import { useEffect, useRef } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';

interface SectionViewTrackerProps {
  section: string;
  feature?: string;
  surface?: string;
}

export function SectionViewTracker({
  section,
  feature = 'landing',
  surface = 'landing_page',
}: SectionViewTrackerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        trackEvent(ANALYTICS_EVENTS.landing_section_viewed, {
          feature,
          surface,
          section,
        });
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [feature, section, surface]);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none h-0 w-0" />;
}
