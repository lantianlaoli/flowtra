/**
 * Google Indexing API Integration
 *
 * This module provides utilities for submitting URLs to Google Search Console
 * Indexing API to request indexing or removal of pages.
 *
 * Setup Requirements:
 * 1. Create a Service Account in Google Cloud Console
 * 2. Enable the Indexing API
 * 3. Add the Service Account email as an Owner in Google Search Console
 * 4. Set environment variables: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY
 */

import { google, indexing_v3 } from 'googleapis';

type PublishUrlResponse = indexing_v3.Schema$PublishUrlNotificationResponse;
type UrlMetadataResponse = indexing_v3.Schema$UrlNotificationMetadata;

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';

/**
 * Initialize Google Auth with Service Account credentials
 */
function getAuthClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google API credentials not configured. Please set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.');
  }

  // Handle private key formatting (replace \\n with actual newlines)
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: formattedPrivateKey,
    },
    scopes: [INDEXING_SCOPE],
  });

  return auth;
}

/**
 * Submit a single URL to Google Indexing API
 *
 * @param url - The full URL to submit for indexing
 * @param type - The type of notification: 'URL_UPDATED' or 'URL_DELETED'
 * @returns Response from Google Indexing API
 */
export async function submitUrlToIndex(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{ success: boolean; error?: string; data?: PublishUrlResponse }> {
  try {
    const auth = getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: type,
      },
    });

    console.log(`✅ Successfully submitted URL to Google Indexing API: ${url}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error(`❌ Failed to submit URL to Google Indexing API: ${url}`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get the indexing status of a URL
 *
 * @param url - The full URL to check
 * @returns Metadata about the URL from Google Indexing API
 */
export async function getIndexingStatus(url: string): Promise<{ success: boolean; error?: string; data?: UrlMetadataResponse }> {
  try {
    const auth = getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth });

    const response = await indexing.urlNotifications.getMetadata({
      url: url,
    });

    console.log(`✅ Successfully retrieved indexing status for: ${url}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error(`❌ Failed to get indexing status for: ${url}`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch submit multiple URLs to Google Indexing API
 *
 * Note: Google Indexing API has a quota limit (200 requests per day for free tier).
 * This function processes URLs sequentially to avoid rate limiting.
 *
 * @param urls - Array of full URLs to submit
 * @param delayMs - Delay between requests in milliseconds (default: 100ms)
 * @returns Summary of submission results
 */
export async function batchSubmitUrls(
  urls: string[],
  delayMs: number = 100
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ url: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ url: string; success: boolean; error?: string }> = [];
  let successful = 0;
  let failed = 0;

  console.log(`📤 Starting batch submission of ${urls.length} URLs to Google Indexing API...`);

  for (const url of urls) {
    const result = await submitUrlToIndex(url);

    results.push({
      url,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Add delay between requests to avoid rate limiting
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`✅ Batch submission complete: ${successful} successful, ${failed} failed out of ${urls.length} total`);

  return {
    total: urls.length,
    successful,
    failed,
    results,
  };
}

/**
 * Retry a failed URL submission with exponential backoff
 *
 * @param url - The URL to retry
 * @param maxRetries - Maximum number of retry attempts
 * @returns Result of the retry operation
 */
export async function retryUrlSubmission(
  url: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string; attempts: number }> {
  let attempts = 0;
  let lastError = '';

  while (attempts < maxRetries) {
    attempts++;

    // Exponential backoff: 1s, 2s, 4s
    if (attempts > 1) {
      const delay = Math.pow(2, attempts - 1) * 1000;
      console.log(`⏳ Retrying URL submission in ${delay}ms (attempt ${attempts}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await submitUrlToIndex(url);

    if (result.success) {
      return { success: true, attempts };
    }

    lastError = result.error || 'Unknown error';
  }

  return {
    success: false,
    error: lastError,
    attempts,
  };
}
