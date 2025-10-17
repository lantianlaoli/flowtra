'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import VideoAudioManager from './useVideoAudioManager';

interface UseVideoAudioOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  instanceId?: string; // Optional custom instance ID
}

// Generate unique instance ID
let instanceCounter = 0;
function generateInstanceId(): string {
  return `video-${Date.now()}-${++instanceCounter}`;
}

export function useVideoAudio({ videoRef, instanceId }: UseVideoAudioOptions) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [needsClickToEnable, setNeedsClickToEnable] = useState(false);

  // Stable instance ID for this video player
  const videoInstanceId = useRef(instanceId || generateInstanceId());
  const managerRef = useRef<VideoAudioManager | null>(null);

  // Initialize manager and register this video instance
  useEffect(() => {
    managerRef.current = VideoAudioManager.getInstance();
    managerRef.current.register(videoInstanceId.current, videoRef, setAudioEnabled);

    return () => {
      managerRef.current?.unregister(videoInstanceId.current);
    };
  }, [videoRef]);

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

  // Note: We removed auto-enable audio on load to prevent multiple videos playing simultaneously
  // Audio will only be enabled on hover or click, managed by the global audio manager

  const handleHover = useCallback(() => {
    setIsHovered(true);
    if (!videoRef.current || !managerRef.current) return;

    // Request audio control from manager (this will mute other videos)
    const canEnableAudio = managerRef.current.requestAudio(videoInstanceId.current);
    if (!canEnableAudio) return;

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

    if (videoRef.current && managerRef.current) {
      try {
        // Release audio control from manager
        managerRef.current.releaseAudio(videoInstanceId.current);

        // Mute the video
        videoRef.current.muted = true;
        setAudioEnabled(false);
      } catch (error) {
        console.warn('Failed to mute video:', error);
      }
    }
  }, [videoRef]);

  const handleClickEnable = useCallback(() => {
    if (!videoRef.current || !managerRef.current) return;

    try {
      setUserHasInteracted(true);

      // Request audio control from manager
      managerRef.current.requestAudio(videoInstanceId.current);

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
