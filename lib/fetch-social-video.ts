/**
 * Social Video URL Fetching Utility
 *
 * Fetches video CDN URLs and metadata from multiple social media platforms via
 * the All-in-One Video Download RapidAPI. Supports TikTok, Instagram, YouTube,
 * Facebook and many more platforms.
 *
 * API: https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink
 * Method: POST { url: "<social_media_url>" }
 *
 * Response structure (confirmed via live tests 2026-03-22):
 *   {
 *     url: string,          // original URL
 *     source: string,       // platform name (tiktok, instagram, youtube, facebook, ...)
 *     title: string,
 *     author: string,
 *     thumbnail: string,    // cover image URL
 *     duration: number,     // seconds (Facebook returns ms — needs /1000)
 *     medias: [{
 *       url: string,        // download URL
 *       quality: string,    // e.g. "hd_no_watermark", "HD", "mp4 (1080p)"
 *       type: string,       // "video" | "audio"
 *       extension: string,  // "mp4"
 *       is_audio?: boolean,
 *       width?: number,
 *       height?: number,
 *       data_size?: number,
 *     }],
 *     error: boolean | string,
 *   }
 */

// =============================================================================
// TYPES
// =============================================================================

interface SocialApiMedia {
  url: string;
  quality?: string;
  type?: string;
  extension?: string;
  is_audio?: boolean;
  width?: number;
  height?: number;
  data_size?: number;
  label?: string;
}

interface SocialApiResponse {
  url?: string;
  source?: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  duration?: number;
  medias?: SocialApiMedia[];
  type?: string;
  error?: boolean | string;
  time_end?: number;
}

export interface SocialVideoInfo {
  /** Best-quality watermark-free video download URL */
  videoUrl: string;
  /** Thumbnail / cover image URL (from API response thumbnail field) */
  thumbnailUrl: string | null;
  /** Video title or description */
  title: string | null;
  /** Duration in seconds (null if unavailable) */
  durationSeconds: number | null;
  /** Detected platform name (tiktok, instagram, youtube, facebook, ...) */
  platform: string | null;
}

export class SocialVideoFetchError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'SocialVideoFetchError';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RAPIDAPI_CONFIG = {
  baseUrl: 'https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink',
  host: 'auto-download-all-in-one.p.rapidapi.com',
  timeout: 20000
};

// Supported platform URL patterns
const SOCIAL_URL_PATTERNS = [
  // TikTok
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
  /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
  /^https?:\/\/vt\.tiktok\.com\/[\w]+/,
  // Instagram
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+/,
  // YouTube
  /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[\w-]+/,
  /^https?:\/\/youtu\.be\/[\w-]+/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  // Facebook
  /^https?:\/\/(www\.)?facebook\.com\/(reel|watch|video)\/[\w]+/,
  /^https?:\/\/(www\.)?facebook\.com\/.*\/videos\/[\w]+/,
  /^https?:\/\/fb\.watch\/[\w-]+/,
  // Twitter / X
  /^https?:\/\/(www\.)?(twitter|x)\.com\/\w+\/status\/\d+/,
  // Pinterest
  /^https?:\/\/(www\.)?pinterest\.(com|co\.uk|fr|de|es|it|jp|com\.au|ca|at|ch|nl|be|dk|fi|no|se|pt|ru|ar|mx|co|pe|cl|br|nz|in|sg|ie|ph|za|tw)\/pin\/\d+/,
];

// Quality preference scores for selecting best video
const QUALITY_SCORES: Record<string, number> = {
  'hd_no_watermark': 100,
  'watermark': 50,
  'hd': 90,
  'HD': 90,
  'sd': 40,
  'SD': 40,
};

function getResolutionScore(quality: string): number {
  const match = quality.match(/(\d+)p/i);
  return match ? parseInt(match[1], 10) : 0;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates if a string is a supported social media URL for video download.
 * Supported: TikTok, Instagram, YouTube, Facebook, Twitter/X, Pinterest.
 */
export function isValidSocialVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return SOCIAL_URL_PATTERNS.some(pattern => pattern.test(url.trim()));
}

/**
 * Detects the platform name from a social media URL.
 */
export function detectPlatform(url: string): string | null {
  const t = url.trim().toLowerCase();
  if (t.includes('tiktok.com') || t.includes('vm.tiktok.com') || t.includes('vt.tiktok.com')) return 'tiktok';
  if (t.includes('instagram.com')) return 'instagram';
  if (t.includes('youtube.com') || t.includes('youtu.be')) return 'youtube';
  if (t.includes('facebook.com') || t.includes('fb.watch')) return 'facebook';
  if (t.includes('twitter.com') || t.includes('x.com')) return 'twitter';
  if (t.includes('pinterest.')) return 'pinterest';
  return null;
}

// =============================================================================
// INTERNAL: VIDEO SELECTION
// =============================================================================

function selectBestVideoMedia(medias: SocialApiMedia[]): SocialApiMedia | null {
  if (!medias || medias.length === 0) return null;

  const videoMedias = medias.filter(m => {
    // Exclude entries whose type is explicitly 'audio'
    if (m.type === 'audio') return false;
    // Exclude TikTok audio-only entries: quality='audio' and no video type
    const q = (m.quality || '').toLowerCase();
    if (q === 'audio' && !m.type) return false;
    // Keep everything else — is_audio on Instagram means "has audio track", not audio-only
    return true;
  });

  if (videoMedias.length === 0) return null;
  if (videoMedias.length === 1) return videoMedias[0];

  const scored = videoMedias.map(m => {
    const quality = (m.quality || m.label || '').toLowerCase();
    let score = 0;

    for (const [key, val] of Object.entries(QUALITY_SCORES)) {
      if (quality.includes(key.toLowerCase())) {
        score = Math.max(score, val);
        break;
      }
    }

    const resScore = getResolutionScore(quality);
    if (resScore > 0 && score === 0) score = resScore;

    return { media: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].media;
}

// =============================================================================
// INTERNAL: CORE API CALL WITH RETRY
// =============================================================================

async function callSocialApi(socialUrl: string): Promise<SocialApiResponse> {
  if (!process.env.RAPID_API_KEY) {
    console.error('[callSocialApi] RAPID_API_KEY is not set');
    throw new SocialVideoFetchError('Video fetching is not configured. Please contact support.', 500);
  }

  const apiHeaders = {
    'Content-Type': 'application/json',
    'x-rapidapi-key': process.env.RAPID_API_KEY,
    'x-rapidapi-host': RAPIDAPI_CONFIG.host
  };

  const MAX_RETRIES = 5;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RAPIDAPI_CONFIG.timeout);

      const response = await fetch(RAPIDAPI_CONFIG.baseUrl, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ url: socialUrl.trim() }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isRetriable = response.status === 429 || response.status >= 500 || response.status === 408;

        if (isRetriable && attempt < MAX_RETRIES) {
          console.warn(`[callSocialApi] HTTP ${response.status}. Retrying (${attempt}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }

        if (response.status === 429) throw new SocialVideoFetchError('Too many requests. Please wait and try again.', 429);
        if (response.status === 403) throw new SocialVideoFetchError('Video is private or unavailable.', 403);
        if (response.status === 404) throw new SocialVideoFetchError('Video not found. Please check the link.', 404);
        throw new SocialVideoFetchError(`API error: ${response.status} ${response.statusText}`, response.status);
      }

      const data = await response.json() as SocialApiResponse;

      if (data.error) {
        const errMsg = typeof data.error === 'string' ? data.error : 'Unknown API error';
        console.warn(`[callSocialApi] API error: "${errMsg}". Attempt ${attempt}/${MAX_RETRIES}`);

        const isRetriable =
          errMsg.toLowerCase().includes('timeout') ||
          errMsg.toLowerCase().includes('try again') ||
          errMsg.toLowerCase().includes('unavailable');

        if (isRetriable && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }

        throw new SocialVideoFetchError(`Failed to fetch video: ${errMsg}`, 400);
      }

      if (!data.medias || data.medias.length === 0) {
        console.warn(`[callSocialApi] No media entries. Attempt ${attempt}/${MAX_RETRIES}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        throw new SocialVideoFetchError('No downloadable media found. The video may be unavailable.', 500);
      }

      return data;

    } catch (reqError) {
      lastError = reqError as Error;

      if (reqError instanceof SocialVideoFetchError) {
        if (attempt >= MAX_RETRIES) throw reqError;
        continue;
      }

      if (reqError instanceof Error && reqError.name === 'AbortError') {
        console.warn(`[callSocialApi] Timeout (${RAPIDAPI_CONFIG.timeout}ms). Attempt ${attempt}/${MAX_RETRIES}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        throw new SocialVideoFetchError('Request timeout. Please try again.', 408);
      }

      console.warn(`[callSocialApi] Network error: ${reqError}. Attempt ${attempt}/${MAX_RETRIES}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }

      throw new SocialVideoFetchError('Network error. Please check your connection and try again.', 500);
    }
  }

  throw lastError || new SocialVideoFetchError('Failed to fetch video after maximum retries.', 500);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Fetches full video info (video URL, cover thumbnail, title, duration) from a
 * social media post URL. Preferred over fetchSocialVideoUrl when you need
 * multiple fields from the same API call.
 *
 * @param socialUrl - Social media post URL
 * @throws {SocialVideoFetchError}
 *
 * @example
 * const { videoUrl, thumbnailUrl, durationSeconds } =
 *   await fetchSocialVideoInfo('https://www.tiktok.com/@user/video/123');
 */
export async function fetchSocialVideoInfo(socialUrl: string): Promise<SocialVideoInfo> {
  if (!isValidSocialVideoUrl(socialUrl)) {
    throw new SocialVideoFetchError(
      'Unsupported URL. Please provide a TikTok, Instagram, YouTube, or Facebook video link.',
      400
    );
  }

  const data = await callSocialApi(socialUrl);

  const bestMedia = selectBestVideoMedia(data.medias!);
  if (!bestMedia?.url) {
    throw new SocialVideoFetchError('Could not extract a video URL from the response.', 500);
  }

  // Facebook returns duration in ms; TikTok sometimes also returns ms (e.g. 41567 instead of 41).
  // Heuristic: if duration > 7200 and platform is not known to be hours-long, treat as ms.
  let durationSeconds: number | null = null;
  if (typeof data.duration === 'number' && data.duration > 0) {
    const platform = data.source?.toLowerCase() || detectPlatform(socialUrl) || '';
    if (platform === 'facebook') {
      durationSeconds = Math.round(data.duration / 1000);
    } else if (data.duration > 7200) {
      // Suspiciously large — likely milliseconds (e.g. TikTok returning 41567 ms)
      durationSeconds = Math.round(data.duration / 1000);
    } else {
      durationSeconds = data.duration;
    }
  }

  return {
    videoUrl: bestMedia.url,
    thumbnailUrl: data.thumbnail || null,
    title: data.title || null,
    durationSeconds,
    platform: data.source || detectPlatform(socialUrl),
  };
}

/**
 * Fetches a video CDN URL from a social media post URL.
 * Use fetchSocialVideoInfo() when you also need thumbnail/duration.
 *
 * @param socialUrl - Social media post URL
 * @returns CDN URL for the best available video quality
 * @throws {SocialVideoFetchError}
 */
export async function fetchSocialVideoUrl(socialUrl: string): Promise<string> {
  const info = await fetchSocialVideoInfo(socialUrl);
  return info.videoUrl;
}
