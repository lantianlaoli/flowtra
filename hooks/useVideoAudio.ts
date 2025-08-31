'use client';

import { useCallback, useState, useEffect } from 'react';

interface UseVideoAudioOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVideoAudio({ videoRef }: UseVideoAudioOptions) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Detect any user interaction to enable audio capability
  useEffect(() => {
    const handleInteraction = () => {
      setUserHasInteracted(true);
    };

    // Listen for any user interaction
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const handleHover = useCallback(() => {
    setIsHovered(true);
    
    if (videoRef.current) {
      try {
        // Enable audio on hover - this counts as user interaction
        // This provides better UX for video previews
        if (!userHasInteracted) {
          setUserHasInteracted(true);
        }
        videoRef.current.muted = false;
        setAudioEnabled(true);
      } catch (error) {
        console.warn('Failed to unmute video:', error);
      }
    }
  }, [videoRef, userHasInteracted]);

  const handleLeave = useCallback(() => {
    setIsHovered(false);
    
    if (videoRef.current) {
      try {
        // Simply mute - don't touch video playback
        videoRef.current.muted = true;
        setAudioEnabled(false);
      } catch (error) {
        console.warn('Failed to mute video:', error);
      }
    }
  }, [videoRef]);

  return {
    audioEnabled,
    userHasInteracted,
    isHovered,
    handleHover,
    handleLeave
  };
}