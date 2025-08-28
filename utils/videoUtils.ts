/**
 * Video utilities for handling cross-browser compatibility and autoplay policies
 */

export interface VideoState {
  canPlay: boolean;
  hasAudio: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  error?: string;
}

export const getVideoState = (video: HTMLVideoElement): VideoState => {
  try {
    const videoAny = video as any;
    return {
      canPlay: video.readyState >= 2,
      hasAudio: videoAny.mozHasAudio || 
                Boolean(videoAny.webkitAudioDecodedByteCount) ||
                Boolean(videoAny.audioTracks && videoAny.audioTracks.length > 0),
      isPlaying: !video.paused && !video.ended && video.currentTime > 0,
      isMuted: video.muted,
    };
  } catch (error) {
    return {
      canPlay: false,
      hasAudio: false,
      isPlaying: false,
      isMuted: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const attemptVideoPlay = async (video: HTMLVideoElement): Promise<boolean> => {
  try {
    await video.play();
    return true;
  } catch (error) {
    console.warn('Video play failed:', error);
    
    // Try common fallback strategies
    try {
      // Ensure video is muted first
      video.muted = true;
      await video.play();
      return true;
    } catch (fallbackError) {
      console.warn('Video play fallback failed:', fallbackError);
      return false;
    }
  }
};

export const canAutoplayWithSound = (): boolean => {
  // Feature detection for autoplay with sound support
  if (typeof navigator === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
  
  // Most mobile browsers and Safari require user interaction for audio
  return !isMobile && !isSafari;
};

export const detectBrowserCapabilities = () => {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return {
      supportsAutoplay: false,
      supportsAudioAutoplay: false,
      isMobile: false,
      userAgent: 'unknown'
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  return {
    supportsAutoplay: true, // Most modern browsers support muted autoplay
    supportsAudioAutoplay: canAutoplayWithSound(),
    isMobile,
    userAgent
  };
};