/**
 * IndexNow API Integration
 *
 * IndexNow is a protocol that allows website owners to instantly notify search engines
 * about the latest content changes on their website. Supported by Bing, Yandex, and other
 * search engines.
 *
 * Benefits:
 * - Free and unlimited (no quota restrictions)
 * - Instant indexing (minutes to hours on Bing/Yandex)
 * - Compliant for all content types (unlike Google Indexing API)
 * - Simple authentication (just an API key file)
 *
 * Setup Requirements:
 * 1. Generate or use an API key (8-128 hexadecimal characters)
 * 2. Place the key in a public text file: /public/[KEY].txt
 * 3. Set INDEXNOW_API_KEY environment variable
 *
 * API Documentation: https://www.indexnow.org/documentation
 */

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const SITE_HOST = 'www.flowtra.store';

/**
 * Submit URLs to IndexNow API
 *
 * This notifies Bing, Yandex, and other supporting search engines that
 * the specified URLs have been updated and should be crawled/indexed.
 *
 * @param urls - Array of full URLs to submit (max 10,000)
 * @returns Result of the submission
 */
export async function submitToIndexNow(
  urls: string[]
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  const apiKey = process.env.INDEXNOW_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'INDEXNOW_API_KEY environment variable not configured',
    };
  }

  if (urls.length === 0) {
    return {
      success: false,
      error: 'No URLs provided',
    };
  }

  if (urls.length > 10000) {
    return {
      success: false,
      error: `Too many URLs (${urls.length}). Maximum is 10,000 per request`,
    };
  }

  try {
    console.log(`[IndexNow] Submitting ${urls.length} URLs...`);

    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        host: SITE_HOST,
        key: apiKey,
        keyLocation: `https://${SITE_HOST}/${apiKey}.txt`,
        urlList: urls,
      }),
    });

    // IndexNow API returns:
    // - 200: OK, URLs received
    // - 202: Accepted, URLs received (some endpoints use this)
    // - 400: Bad request (invalid format)
    // - 403: Forbidden (key verification failed)
    // - 422: Unprocessable Entity (invalid URLs)
    // - 429: Too many requests (rate limit, though IndexNow claims no limits)

    if (response.status === 200 || response.status === 202) {
      console.log(`✅ [IndexNow] Successfully submitted ${urls.length} URLs`);
      return {
        success: true,
        statusCode: response.status,
      };
    }

    // Handle error responses
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(
      `❌ [IndexNow] Failed with status ${response.status}: ${errorText}`
    );

    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
      statusCode: response.status,
    };
  } catch (error: unknown) {
    console.error(`❌ [IndexNow] Request failed:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch submit URLs with automatic chunking
 *
 * Splits large URL lists into chunks of 10,000 (IndexNow's limit)
 * and submits them sequentially.
 *
 * @param urls - Array of full URLs to submit
 * @param chunkSize - Size of each batch (default: 10,000, max allowed by IndexNow)
 * @returns Summary of all submissions
 */
export async function batchSubmitToIndexNow(
  urls: string[],
  chunkSize: number = 10000
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ success: boolean; count: number; error?: string }>;
}> {
  const results: Array<{ success: boolean; count: number; error?: string }> = [];
  let successful = 0;
  let failed = 0;

  console.log(
    `[IndexNow] Starting batch submission of ${urls.length} URLs (chunks of ${chunkSize})...`
  );

  // Split URLs into chunks
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const chunkNumber = Math.floor(i / chunkSize) + 1;
    const totalChunks = Math.ceil(urls.length / chunkSize);

    console.log(`[IndexNow] Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} URLs)...`);

    const result = await submitToIndexNow(chunk);

    results.push({
      success: result.success,
      count: chunk.length,
      error: result.error,
    });

    if (result.success) {
      successful += chunk.length;
    } else {
      failed += chunk.length;
    }

    // Add a small delay between chunks to be polite (though IndexNow has no rate limits)
    if (i + chunkSize < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(
    `✅ [IndexNow] Batch submission complete: ${successful} successful, ${failed} failed out of ${urls.length} total`
  );

  return {
    total: urls.length,
    successful,
    failed,
    results,
  };
}

/**
 * Verify that the API key file is accessible
 *
 * IndexNow requires the key to be publicly accessible at:
 * https://[host]/[key].txt
 *
 * @returns Whether the key file is accessible
 */
export async function verifyIndexNowKeyFile(): Promise<{
  accessible: boolean;
  error?: string;
}> {
  const apiKey = process.env.INDEXNOW_API_KEY;

  if (!apiKey) {
    return {
      accessible: false,
      error: 'INDEXNOW_API_KEY not configured',
    };
  }

  const keyFileUrl = `https://${SITE_HOST}/${apiKey}.txt`;

  try {
    console.log(`[IndexNow] Verifying key file at: ${keyFileUrl}`);

    const response = await fetch(keyFileUrl, {
      method: 'GET',
    });

    if (response.status === 200) {
      const content = await response.text();
      const trimmedContent = content.trim();

      // Verify the file contains the correct key
      if (trimmedContent === apiKey) {
        console.log(`✅ [IndexNow] Key file is accessible and valid`);
        return { accessible: true };
      } else {
        console.error(
          `❌ [IndexNow] Key file content mismatch. Expected: ${apiKey}, Got: ${trimmedContent}`
        );
        return {
          accessible: false,
          error: 'Key file content does not match INDEXNOW_API_KEY',
        };
      }
    } else {
      console.error(`❌ [IndexNow] Key file not accessible. Status: ${response.status}`);
      return {
        accessible: false,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error: unknown) {
    console.error(`❌ [IndexNow] Failed to verify key file:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      accessible: false,
      error: errorMessage,
    };
  }
}
