/**
 * TikTok Video URL Fetching Utility
 *
 * Fetches TikTok video CDN URLs via RapidAPI for competitor video analysis.
 * This utility extracts the direct video URL from a TikTok post link.
 *
 * @see docs/tiktok/README.md for RapidAPI setup instructions
 */

// =============================================================================
// TYPES
// =============================================================================

interface TikTokApiResponse {
  play?: string;          // Watermark-free video URL
  play_watermark?: string; // Video with TikTok watermark
  error?: string;
}

export class TikTokFetchError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TikTokFetchError';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RAPIDAPI_CONFIG = {
  baseUrl: 'https://tiktok-api23.p.rapidapi.com/api/download/video',
  headers: {
    'x-rapidapi-key': process.env.RAPID_API_KEY || '',
    'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
  },
  timeout: 15000 // 15 seconds
};

// TikTok URL patterns
const TIKTOK_URL_PATTERNS = [
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,  // Full URL
  /^https?:\/\/vm\.tiktok\.com\/[\w]+/                       // Short URL
];

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates if a string is a valid TikTok URL
 *
 * @param url - URL string to validate
 * @returns true if URL matches TikTok patterns
 *
 * @example
 * isValidTikTokUrl('https://www.tiktok.com/@user/video/123') // true
 * isValidTikTokUrl('https://vm.tiktok.com/ABCD1234/') // true
 * isValidTikTokUrl('https://youtube.com/watch?v=123') // false
 */
export function isValidTikTokUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return TIKTOK_URL_PATTERNS.some(pattern => pattern.test(url.trim()));
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Fetches TikTok video CDN URL from a TikTok post URL
 *
 * @param tiktokUrl - TikTok video URL (full or short link)
 * @returns CDN URL for the video (watermark-free)
 * @throws {TikTokFetchError} If URL is invalid, video not found, or API error
 *
 * @example
 * const cdnUrl = await fetchTikTokVideoUrl('https://www.tiktok.com/@user/video/123');
 * // Returns: 'https://v16m.tiktokcdn.com/...'
 */
export async function fetchTikTokVideoUrl(tiktokUrl: string): Promise<string> {
  // 1. Validate URL format
  if (!isValidTikTokUrl(tiktokUrl)) {
    throw new TikTokFetchError(
      'Invalid TikTok URL format. Please provide a valid TikTok video link.',
      400
    );
  }

  // 2. Check for API key
  if (!process.env.RAPID_API_KEY) {
    console.error('[fetchTikTokVideoUrl] RAPID_API_KEY environment variable is not set');
    throw new TikTokFetchError(
      'TikTok video fetching is not configured. Please contact support.',
      500
    );
  }

  // 3. Build API URL
  const apiUrl = `${RAPIDAPI_CONFIG.baseUrl}?url=${encodeURIComponent(tiktokUrl.trim())}`;

  console.log('[fetchTikTokVideoUrl] Fetching TikTok video:', tiktokUrl);

  try {
    // 4. Call RapidAPI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RAPIDAPI_CONFIG.timeout);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: RAPIDAPI_CONFIG.headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 5. Handle non-2xx responses
    if (!response.ok) {
      if (response.status === 404) {
        throw new TikTokFetchError(
          'Video not found. Please check the TikTok link and try again.',
          404
        );
      }

      if (response.status === 429) {
        throw new TikTokFetchError(
          'Too many requests. Please wait a moment and try again.',
          429
        );
      }

      if (response.status === 403) {
        throw new TikTokFetchError(
          'Video is private or unavailable. Please use a public video.',
          403
        );
      }

      // Generic error
      throw new TikTokFetchError(
        `TikTok API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    // 6. Parse response
    const data = await response.json() as TikTokApiResponse;

    // 7. Check for API-level errors
    if (data.error) {
      console.error('[fetchTikTokVideoUrl] TikTok API returned error:', data.error);
      throw new TikTokFetchError(
        `Failed to fetch TikTok video: ${data.error}`,
        400
      );
    }

    // 8. Extract video URL (prefer watermark-free)
    if (!data.play) {
      console.error('[fetchTikTokVideoUrl] Missing "play" field in response:', data);
      throw new TikTokFetchError(
        'TikTok API did not return a valid video URL. The video may be unavailable.',
        500
      );
    }

    console.log('[fetchTikTokVideoUrl] ✅ Successfully fetched video URL');
    console.log('[fetchTikTokVideoUrl] CDN URL:', data.play.substring(0, 80) + '...');

    return data.play;

  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[fetchTikTokVideoUrl] Request timeout after', RAPIDAPI_CONFIG.timeout, 'ms');
      throw new TikTokFetchError(
        'Request timeout while fetching TikTok video. Please try again.',
        408
      );
    }

    // Re-throw TikTokFetchError as-is
    if (error instanceof TikTokFetchError) {
      throw error;
    }

    // Wrap unknown errors
    console.error('[fetchTikTokVideoUrl] Unexpected error:', error);
    throw new TikTokFetchError(
      'Failed to fetch TikTok video. Please try again later.',
      500
    );
  }
}

// =============================================================================
// HELPER: GET VIDEO DURATION (Optional - for validation)
// =============================================================================

/**
 * Extracts video duration from TikTok CDN URL (if available in metadata)
 * Note: This is optional - duration validation can also happen during analysis
 *
 * @param cdnUrl - TikTok CDN video URL
 * @returns Video duration in seconds, or null if unavailable
 */
export async function getTikTokVideoDuration(cdnUrl: string): Promise<number | null> {
  // This would require downloading the video and reading metadata
  // For now, we'll let the analysis step handle duration validation
  // TODO: Implement if needed for early validation
  return null;
}
