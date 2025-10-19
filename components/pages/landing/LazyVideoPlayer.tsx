'use client';

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type VideoPlayerComponent from '@/components/ui/VideoPlayer';

type VideoPlayerProps = ComponentProps<typeof VideoPlayerComponent>;

const ClientVideoPlayer = dynamic(() => import('@/components/ui/VideoPlayer'), {
  ssr: false,
});

interface LazyVideoPlayerProps extends VideoPlayerProps {
  wrapperClassName?: string;
  placeholder?: ReactNode;
}

export function LazyVideoPlayer({
  wrapperClassName,
  placeholder,
  ...videoProps
}: LazyVideoPlayerProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
  }, []);

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
