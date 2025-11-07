/**
 * Google Search Console API Integration
 *
 * This module provides utilities for checking actual indexing status of URLs
 * using the URL Inspection API. This is the ONLY reliable way to verify if
 * a page is truly indexed by Google.
 *
 * Setup Requirements:
 * 1. Use the same Service Account from Google Indexing API setup
 * 2. Enable the Search Console API in Google Cloud Console
 * 3. Add the Service Account as Owner in Google Search Console
 * 4. Environment variables: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY (same as Indexing API)
 *
 * IMPORTANT: URL Inspection API can only verify indexing status, NOT request indexing.
 * Use Google Indexing API (/lib/google-indexing.ts) to request crawling/indexing.
 */

import { google } from 'googleapis';

// Note: URL Inspection API may require full 'webmasters' scope, not just 'readonly'
// This is because inspection involves accessing detailed index information
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters';
// IMPORTANT: Must match Google Search Console property EXACTLY
// Based on diagnostic results, the registered property is: https://www.flowtra.store/ (with trailing slash)
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowtra.store').replace(/\/?$/, '/'); // Ensure trailing slash

/**
 * Initialize Google Auth for Search Console API
 */
function getAuthClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google API credentials not configured. Please set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.'
    );
  }

  // Handle private key formatting (replace \\n with actual newlines)
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: formattedPrivateKey,
    },
    scopes: [SEARCH_CONSOLE_SCOPE],
  });

  return auth;
}

/**
 * Index status result from URL Inspection API
 */
export interface IndexStatusResult {
  isIndexed: boolean;
  verdict?: 'PASS' | 'FAIL' | 'NEUTRAL';
  coverageState?: string;
  lastCrawlTime?: string;
  indexingState?: string;
  pageFetchState?: string;
  robotsTxtState?: string;
  error?: string;
}

/**
 * Check actual indexing status of a URL using URL Inspection API
 *
 * This is the ONLY reliable way to verify if a page is truly indexed by Google.
 * Unlike getIndexingStatus() from google-indexing.ts (which only returns submission
 * history), this method queries Google's actual index.
 *
 * Quota: 2,000 requests per day per property
 *
 * @param url - The full URL to check (e.g., https://www.flowtra.store/blog/article-slug)
 * @returns Actual indexing status from Google Search Console
 */
export async function checkActualIndexingStatus(
  url: string
): Promise<IndexStatusResult> {
  try {
    const auth = getAuthClient();
    const searchConsole = google.searchconsole({ version: 'v1', auth });

    console.log(`[Search Console API] Checking indexing status for: ${url}`);

    const response = await searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: url,
        siteUrl: SITE_URL,
      },
    });

    const inspectionResult = response.data.inspectionResult;
    const indexStatusResult = inspectionResult?.indexStatusResult;

    // Check if the page is actually indexed
    const isIndexed = indexStatusResult?.verdict === 'PASS';

    console.log(
      `✅ [Search Console API] Status retrieved for ${url}: ${
        isIndexed ? 'INDEXED' : 'NOT INDEXED'
      }`
    );

    return {
      isIndexed,
      verdict: indexStatusResult?.verdict as 'PASS' | 'FAIL' | 'NEUTRAL' | undefined,
      coverageState: indexStatusResult?.coverageState || undefined,
      lastCrawlTime: indexStatusResult?.lastCrawlTime || undefined,
      indexingState: indexStatusResult?.indexingState || undefined,
      pageFetchState: indexStatusResult?.pageFetchState || undefined,
      robotsTxtState: indexStatusResult?.robotsTxtState || undefined,
    };
  } catch (error: unknown) {
    console.error(`❌ [Search Console API] Failed to check status for ${url}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      isIndexed: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch check indexing status for multiple URLs
 *
 * Processes URLs sequentially with delay to respect rate limits.
 * Quota: 2,000 requests per day per property
 *
 * @param urls - Array of full URLs to check
 * @param delayMs - Delay between requests in milliseconds (default: 500ms)
 * @returns Array of status results
 */
export async function batchCheckIndexingStatus(
  urls: string[],
  delayMs: number = 500
): Promise<
  Array<{
    url: string;
    result: IndexStatusResult;
  }>
> {
  const results: Array<{ url: string; result: IndexStatusResult }> = [];

  console.log(
    `[Search Console API] Starting batch status check for ${urls.length} URLs...`
  );

  for (const url of urls) {
    const result = await checkActualIndexingStatus(url);
    results.push({ url, result });

    // Add delay between requests to avoid rate limiting
    if (delayMs > 0 && urls.indexOf(url) < urls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const indexedCount = results.filter((r) => r.result.isIndexed).length;
  console.log(
    `✅ [Search Console API] Batch check complete: ${indexedCount}/${urls.length} URLs are indexed`
  );

  return results;
}
