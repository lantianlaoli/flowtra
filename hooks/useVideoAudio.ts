'use client';

import { useCallback, useState, useEffect } from 'react';

interface UseVideoAudioOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVideoAudio({ videoRef }: UseVideoAudioOptions) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [needsClickToEnable, setNeedsClickToEnable] = useState(false);

  // Detect any user interaction to enable audio capability
  useEffect(() => {
    const handleInteraction = () => {
      setUserHasInteracted(true);
    };

    // Listen for any user interaction that browsers consider activation
    document.addEventListener('pointerdown', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('pointerdown', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const handleHover = useCallback(() => {
    setIsHovered(true);
    if (!videoRef.current) return;

    // Only attempt audio if user has interacted (browser policy)
    if (userHasInteracted) {
      try {
        videoRef.current.muted = false;
        const playPromise = videoRef.current.play?.();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              setAudioEnabled(true);
              setNeedsClickToEnable(false);
            })
            .catch(() => {
              // Fallback: require click to enable
              setAudioEnabled(false);
              setNeedsClickToEnable(true);
            });
        } else {
          // Older browsers
          setAudioEnabled(true);
          setNeedsClickToEnable(false);
        }
      } catch (error) {
        console.warn('Failed to unmute/play video:', error);
        setNeedsClickToEnable(true);
        setAudioEnabled(false);
      }
    } else {
      // No prior interaction – show hint to click
      setNeedsClickToEnable(true);
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

  const handleClickEnable = useCallback(() => {
    if (!videoRef.current) return;
    try {
      setUserHasInteracted(true);
      videoRef.current.muted = false;
      const playPromise = videoRef.current.play?.();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            setAudioEnabled(true);
            setNeedsClickToEnable(false);
          })
          .catch((err) => {
            console.warn('Play with audio failed:', err);
            setAudioEnabled(false);
            setNeedsClickToEnable(true);
          });
      } else {
        setAudioEnabled(true);
        setNeedsClickToEnable(false);
      }
    } catch (error) {
      console.warn('Failed to enable audio on click:', error);
      setNeedsClickToEnable(true);
      setAudioEnabled(false);
    }
  }, [videoRef]);

  return {
    audioEnabled,
    userHasInteracted,
    isHovered,
    needsClickToEnable,
    handleHover,
    handleLeave,
    handleClickEnable
  };
}
