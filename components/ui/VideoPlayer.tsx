'use client';

import { useRef, forwardRef } from 'react';
import { useVideoAudio } from '@/hooks/useVideoAudio';

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  showControls?: boolean;
  captionsUrl?: string;
  ariaLabel?: string;
  instanceId?: string; // Optional custom instance ID for debugging
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({
    src,
    className = '',
    autoPlay = false,
    loop = true,
    playsInline = true,
    showControls = false,
    captionsUrl,
    ariaLabel,
    instanceId
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Use the passed ref or our internal ref
    const currentRef = (ref as React.RefObject<HTMLVideoElement>) || videoRef;

    const {
      audioEnabled,
      needsClickToEnable,
      handleHover,
      handleLeave,
      handleClickEnable,
    } = useVideoAudio({ videoRef: currentRef, instanceId });

    return (
      <div 
        className="relative group w-full h-full"
      >
        <video
          ref={currentRef}
          className={`w-full h-full object-cover ${className}`}
          autoPlay={autoPlay}
          muted={!audioEnabled}
          loop={loop}
          playsInline={playsInline}
          preload="none"
          controls={showControls}
          aria-label={ariaLabel || "Product demonstration video"}
          onError={(e) => console.warn('Video error:', e)}
          onMouseEnter={handleHover}
          onFocus={handleHover}
          onMouseLeave={handleLeave}
          onBlur={handleLeave}
          onClick={handleClickEnable}
          onLoadedMetadata={() => {
            // Respect current audio state; ensure muted only if audio not enabled
            if (currentRef.current && !audioEnabled) {
              currentRef.current.muted = true;
            }
          }}
        >
          <source src={src} type="video/mp4" />
          {captionsUrl && (
            <track
              kind="captions"
              src={captionsUrl}
              srcLang="en"
              label="English captions"
              default
            />
          )}
          Your browser does not support the video tag.
        </video>
        {/* Click-to-enable overlay when required by browser policy */}
        {(needsClickToEnable || showControls) && !audioEnabled && (
          <button
            type="button"
            onClick={handleClickEnable}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm hover:bg-black/80 whitespace-nowrap"
          >
            <span className="sm:hidden">Unmute</span>
            <span className="hidden sm:inline">Click to enable sound</span>
          </button>
        )}
        {showControls && audioEnabled && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm">
            Audio on
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
