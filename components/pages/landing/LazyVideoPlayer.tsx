'use client';

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type VideoPlayerComponent from '@/components/ui/VideoPlayer';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';

type VideoPlayerProps = ComponentProps<typeof VideoPlayerComponent>;

const ClientVideoPlayer = dynamic(() => import('@/components/ui/VideoPlayer'), {
  ssr: false,
});

interface LazyVideoPlayerProps extends VideoPlayerProps {
  wrapperClassName?: string;
  placeholder?: ReactNode;
  eager?: boolean;
  analyticsName?: string;
  analyticsFeature?: string;
  analyticsSurface?: string;
}

export function LazyVideoPlayer({
  wrapperClassName,
  placeholder,
  eager = false,
  analyticsName,
  analyticsFeature = 'landing',
  analyticsSurface = 'landing_page',
  ...videoProps
}: LazyVideoPlayerProps) {
  const [shouldRender, setShouldRender] = useState(eager);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackedPlaybackRef = useRef(false);

  useEffect(() => {
    if (eager) {
      setShouldRender(true);
      return;
    }

    if (!containerRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!shouldRender || trackedPlaybackRef.current || !analyticsName) {
      return;
    }

    trackedPlaybackRef.current = true;
    trackEvent(ANALYTICS_EVENTS.landing_demo_video_played, {
      feature: analyticsFeature,
      surface: analyticsSurface,
      section: analyticsName,
    });
  }, [analyticsFeature, analyticsName, analyticsSurface, shouldRender]);

  return (
    <div ref={containerRef} className={wrapperClassName}>
      {shouldRender ? (
        <ClientVideoPlayer {...videoProps} />
      ) : (
        placeholder ?? (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">
            Loading preview…
          </div>
        )
      )}
    </div>
  );
}
