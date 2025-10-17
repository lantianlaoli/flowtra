'use client';

/**
 * Global Video Audio Manager
 * Ensures only one video plays audio at a time across the entire application
 */

type VideoInstance = {
  id: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setAudioEnabled: (enabled: boolean) => void;
};

class VideoAudioManager {
  private static instance: VideoAudioManager;
  private activeVideoId: string | null = null;
  private registeredVideos: Map<string, VideoInstance> = new Map();

  private constructor() {}

  static getInstance(): VideoAudioManager {
    if (!VideoAudioManager.instance) {
      VideoAudioManager.instance = new VideoAudioManager();
    }
    return VideoAudioManager.instance;
  }

  /**
   * Register a video instance
   */
  register(id: string, videoRef: React.RefObject<HTMLVideoElement | null>, setAudioEnabled: (enabled: boolean) => void): void {
    this.registeredVideos.set(id, { id, videoRef, setAudioEnabled });
  }

  /**
   * Unregister a video instance
   */
  unregister(id: string): void {
    if (this.activeVideoId === id) {
      this.activeVideoId = null;
    }
    this.registeredVideos.delete(id);
  }

  /**
   * Request audio for a specific video
   * Automatically mutes all other videos
   */
  requestAudio(id: string): boolean {
    // If this video is already active, do nothing
    if (this.activeVideoId === id) {
      return true;
    }

    // Mute the currently active video if any
    if (this.activeVideoId) {
      const currentActive = this.registeredVideos.get(this.activeVideoId);
      if (currentActive?.videoRef.current) {
        try {
          currentActive.videoRef.current.muted = true;
          currentActive.setAudioEnabled(false);
        } catch (error) {
          console.warn(`Failed to mute video ${this.activeVideoId}:`, error);
        }
      }
    }

    // Set this video as active
    this.activeVideoId = id;
    return true;
  }

  /**
   * Release audio for a specific video
   */
  releaseAudio(id: string): void {
    if (this.activeVideoId === id) {
      this.activeVideoId = null;
    }
  }

  /**
   * Get the currently active video ID
   */
  getActiveVideoId(): string | null {
    return this.activeVideoId;
  }

  /**
   * Check if a specific video is the active one
   */
  isActive(id: string): boolean {
    return this.activeVideoId === id;
  }
}

export default VideoAudioManager;
