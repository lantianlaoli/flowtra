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
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ 
    src, 
    className = '', 
    autoPlay = true, 
    loop = true, 
    playsInline = true,
    showControls = false
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // Use the passed ref or our internal ref
    const currentRef = (ref as React.RefObject<HTMLVideoElement>) || videoRef;
    
    const {
      audioEnabled,
      handleHover,
      handleLeave
    } = useVideoAudio({ videoRef: currentRef });

    const onMouseEnter = () => {
      handleHover();
    };

    const onMouseLeave = () => {
      handleLeave();
    };

    return (
      <div 
        className="relative group"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <video
          ref={currentRef}
          className={`w-full h-full object-cover ${className}`}
          autoPlay={autoPlay}
          muted={!audioEnabled}
          loop={loop}
          playsInline={playsInline}
          preload="metadata"
          controls={false}
          onError={(e) => console.warn('Video error:', e)}
          onLoadedMetadata={() => {
            // Ensure video is muted initially for autoplay compliance
            if (currentRef.current) {
              currentRef.current.muted = true;
            }
          }}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {showControls && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm">
            {audioEnabled ? 'Audio on' : 'Hover for audio'}
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;