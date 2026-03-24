/**
 * TikTok Video URL Fetching Utility
 *
 * Re-exports from lib/fetch-social-video.ts which now supports multiple
 * social media platforms (TikTok, Instagram, YouTube, Facebook, etc.)
 * via the All-in-One Video Download RapidAPI.
 *
 * These exports are kept for backwards compatibility with existing callers.
 */

export {
  SocialVideoFetchError as TikTokFetchError,
  fetchSocialVideoUrl as fetchTikTokVideoUrl,
  fetchSocialVideoInfo as fetchTikTokVideoInfo,
  isValidSocialVideoUrl as isValidTikTokUrl,
  detectPlatform,
} from './fetch-social-video';

// Stub for backwards compatibility
export async function getTikTokVideoDuration(_cdnUrl: string): Promise<number | null> {
  return null;
}
