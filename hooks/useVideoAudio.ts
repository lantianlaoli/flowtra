'use client';

import { useCallback, useState, useEffect } from 'react';

interface UseVideoAudioOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  requireUserInteraction?: boolean;
}

export function useVideoAudio({ videoRef, requireUserInteraction = true }: UseVideoAudioOptions) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Detect user interaction on the page
  useEffect(() => {
    if (!requireUserInteraction) {
      setUserHasInteracted(true);
      return;
    }

    const handleUserInteraction = () => {
      setUserHasInteracted(true);
      document.removeEventListener('click', handleUserInteraction, true);
      document.removeEventListener('touchstart', handleUserInteraction, true);
      document.removeEventListener('keydown', handleUserInteraction, true);
    };

    // Use capture phase to ensure we catch the interaction early
    document.addEventListener('click', handleUserInteraction, true);
    document.addEventListener('touchstart', handleUserInteraction, true);
    document.addEventListener('keydown', handleUserInteraction, true);

    return () => {
      document.removeEventListener('click', handleUserInteraction, true);
      document.removeEventListener('touchstart', handleUserInteraction, true);
      document.removeEventListener('keydown', handleUserInteraction, true);
    };
  }, [requireUserInteraction]);

  const enableAudio = useCallback(async () => {
    if (!videoRef.current || !userHasInteracted) {
      return false;
    }

    try {
      const video = videoRef.current;
      
      // Ensure video is loaded and ready
      if (video.readyState < 2) {
        await new Promise((resolve) => {
          video.addEventListener('loadeddata', resolve, { once: true });
        });
      }

      // Ensure video is playing before unmuting
      if (video.paused) {
        await video.play();
      }
      
      // Small delay to ensure video is stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      video.muted = false;
      setAudioEnabled(true);
      return true;
    } catch (error) {
      console.warn('Failed to enable audio:', error);
      // Fallback: try to play without unmuting first
      try {
        if (videoRef.current && videoRef.current.paused) {
          await videoRef.current.play();
        }
      } catch (playError) {
        console.warn('Failed to play video:', playError);
      }
      return false;
    }
  }, [videoRef, userHasInteracted]);

  const disableAudio = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      setAudioEnabled(false);
    }
  }, [videoRef]);

  const handleHover = useCallback(async () => {
    setIsHovered(true);
    
    if (userHasInteracted) {
      await enableAudio();
    }
  }, [enableAudio, userHasInteracted]);

  const handleLeave = useCallback(() => {
    setIsHovered(false);
    disableAudio();
  }, [disableAudio]);

  const toggleAudio = useCallback(async () => {
    if (audioEnabled) {
      disableAudio();
    } else {
      await enableAudio();
    }
  }, [audioEnabled, enableAudio, disableAudio]);

  return {
    audioEnabled,
    userHasInteracted,
    isHovered,
    handleHover,
    handleLeave,
    toggleAudio,
    enableAudio,
    disableAudio
  };
}