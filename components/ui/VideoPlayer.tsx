'use client';

import { useRef, useState, forwardRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
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
    autoPlay = true,
    loop = true,
    playsInline = true,
    showControls = false,
    captionsUrl,
    ariaLabel,
    instanceId
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);

    // Use the passed ref or our internal ref
    const currentRef = (ref as React.RefObject<HTMLVideoElement>) || videoRef;

    const {
      audioEnabled,
      needsClickToEnable,
      handleHover,
      handleLeave,
      handleClickEnable,
      handleToggleAudio,
    } = useVideoAudio({
      videoRef: currentRef,
      instanceId,
      // Detail viewers with native controls should keep audio after pointer leave.
      releaseAudioOnLeave: !showControls
    });

    return (
      <div 
        className="relative group w-full h-full overflow-hidden rounded-[inherit]"
      >
        {hasError ? (
          <div className="flex h-full w-full items-center justify-center bg-[#F3F3F3] px-4 text-center text-sm font-medium text-[#666666]">
            Preview unavailable
          </div>
        ) : null}
        <video
          ref={currentRef}
          className={`${hasError ? 'hidden' : 'block'} w-full h-full rounded-[inherit] object-cover ${className}`}
          autoPlay={autoPlay}
          muted={!audioEnabled}
          loop={loop}
          playsInline={playsInline}
          preload="metadata"
          controls={showControls}
          aria-label={ariaLabel || "Product demonstration video"}
          onError={(e) => {
            setHasError(true);
            console.warn('Video error:', e);
          }}
          onMouseEnter={handleHover}
          onFocus={handleHover}
          onMouseLeave={handleLeave}
          onBlur={handleLeave}
          onClick={handleClickEnable}
          onLoadedMetadata={() => {
            setHasError(false);
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
        {!hasError && !showControls ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleToggleAudio();
            }}
            className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-2 text-xs font-medium text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-sm transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label={audioEnabled ? 'Mute video audio' : 'Enable video audio'}
          >
            {audioEnabled ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{audioEnabled ? 'Sound on' : needsClickToEnable ? 'Tap for sound' : 'Sound off'}</span>
          </button>
        ) : null}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
