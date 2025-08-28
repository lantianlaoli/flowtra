'use client';

import { useRef, forwardRef, useEffect, useState } from 'react';
import { Volume2, VolumeX, Play, Smartphone } from 'lucide-react';
import { useVideoAudio } from '@/hooks/useVideoAudio';

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  showControls?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ 
    src, 
    className = '', 
    autoPlay = true, 
    loop = true, 
    playsInline = true,
    showControls = true,
    onHover,
    onLeave
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    
    // Use the passed ref or our internal ref
    const currentRef = (ref as React.RefObject<HTMLVideoElement>) || videoRef;
    
    // Detect mobile device
    useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
      };
      
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    const {
      audioEnabled,
      userHasInteracted,
      isHovered,
      handleHover,
      handleLeave,
      toggleAudio
    } = useVideoAudio({ videoRef: currentRef, requireUserInteraction: !isMobile });

    const onMouseEnter = async () => {
      await handleHover();
      onHover?.();
    };

    const onMouseLeave = () => {
      handleLeave();
      onLeave?.();
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
          muted
          loop={loop}
          playsInline={playsInline}
          preload="metadata"
          onError={(e) => console.warn('Video error:', e)}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {showControls && (
          <>
            {/* Audio Status Indicator */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {userHasInteracted && (
                <button
                  onClick={toggleAudio}
                  className="bg-black/70 text-white p-2 rounded-lg hover:bg-black/80 transition-colors backdrop-blur-sm"
                  aria-label={audioEnabled ? 'Mute video' : 'Unmute video'}
                >
                  {audioEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* First Interaction Prompt */}
            {!userHasInteracted && isHovered && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white rounded-lg p-4 text-center shadow-lg max-w-xs mx-4">
                  {isMobile ? (
                    <Smartphone className="w-6 h-6 mx-auto mb-2 text-gray-700" />
                  ) : (
                    <Play className="w-6 h-6 mx-auto mb-2 text-gray-700" />
                  )}
                  <p className="text-sm text-gray-700 font-medium">
                    {isMobile ? 'Tap to enable sound' : 'Click anywhere to enable sound'}
                  </p>
                </div>
              </div>
            )}

            {/* Hover/Touch Indicator */}
            {userHasInteracted && isHovered && !audioEnabled && (
              <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm">
                {isMobile ? 'Tap for sound' : 'Hover for sound'}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;