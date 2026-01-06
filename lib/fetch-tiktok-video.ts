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
    // 4. Call RapidAPI with timeout and retries (including response validation)
    const MAX_RETRIES = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let response: Response | null = null;

      try {
        // 4a. Make HTTP request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RAPIDAPI_CONFIG.timeout);

        response = await fetch(apiUrl, {
          method: 'GET',
          headers: RAPIDAPI_CONFIG.headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 4b. Handle HTTP-level errors (before parsing JSON)
        if (!response.ok) {
          const isRetriable =
            response.status === 429 || // Rate limit
            response.status >= 500 ||  // Server error
            response.status === 404 || // Not found (sometimes flaky)
            response.status === 403;   // Forbidden (sometimes flaky)

          if (isRetriable && attempt < MAX_RETRIES) {
            console.warn(`[fetchTikTokVideoUrl] HTTP ${response.status} error. Retrying... (${attempt}/${MAX_RETRIES})`);
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Non-retriable or final attempt - throw specific error
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

          throw new TikTokFetchError(
            `TikTok API error: ${response.status} ${response.statusText}`,
            response.status
          );
        }

        // 4c. Parse JSON response
        const data = await response.json() as TikTokApiResponse;

        // 4d. Check for API-level errors (data.error field)
        if (data.error) {
          console.warn(`[fetchTikTokVideoUrl] API returned error: "${data.error}". Attempt ${attempt}/${MAX_RETRIES}`);

          // Retry on potentially transient API errors
          const isRetriableApiError =
            data.error.toLowerCase().includes('not found') ||       // Video temporarily unavailable
            data.error.toLowerCase().includes('unavailable') ||      // CDN issues
            data.error.toLowerCase().includes('timeout') ||          // Backend timeout
            data.error.toLowerCase().includes('try again');          // Generic retry hint

          if (isRetriableApiError && attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            const delay = 1000 * Math.pow(2, attempt - 1);
            console.warn(`[fetchTikTokVideoUrl] Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Non-retriable or final attempt
          throw new TikTokFetchError(
            `Failed to fetch TikTok video: ${data.error}`,
            400
          );
        }

        // 4e. Validate response structure
        if (!data.play) {
          console.warn(`[fetchTikTokVideoUrl] Missing "play" field in response. Attempt ${attempt}/${MAX_RETRIES}`);

          // Retry on missing data (might be temporary API issue)
          if (attempt < MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Final attempt - throw error
          throw new TikTokFetchError(
            'TikTok API did not return a valid video URL. The video may be unavailable.',
            500
          );
        }

        // 4f. Success! Return video URL
        console.log('[fetchTikTokVideoUrl] ✅ Successfully fetched video URL');
        console.log('[fetchTikTokVideoUrl] CDN URL:', data.play.substring(0, 80) + '...');
        return data.play;

      } catch (reqError) {
        lastError = reqError as Error;

        // If it's a TikTokFetchError, check if we should retry
        if (reqError instanceof TikTokFetchError) {
          // Already logged above, just re-throw on final attempt
          if (attempt >= MAX_RETRIES) {
            throw reqError;
          }
          // Otherwise continue to next retry
          continue;
        }

        // Handle timeout (AbortError)
        if (reqError instanceof Error && reqError.name === 'AbortError') {
          console.warn(`[fetchTikTokVideoUrl] Request timeout (${RAPIDAPI_CONFIG.timeout}ms). Attempt ${attempt}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new TikTokFetchError(
            'Request timeout while fetching TikTok video. Please try again.',
            408
          );
        }

        // Handle other network errors
        console.warn(`[fetchTikTokVideoUrl] Network error: ${reqError}. Attempt ${attempt}/${MAX_RETRIES}`);
        if (attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Final attempt - throw
        throw new TikTokFetchError(
          'Network error while fetching TikTok video. Please check your connection and try again.',
          500
        );
      }
    }

    // Should never reach here, but handle gracefully
    throw lastError || new TikTokFetchError(
      'Failed to fetch TikTok video after maximum retries.',
      500
    );

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
