/**
 * Multi-API Indexing Submission Cron Job
 *
 * This endpoint is triggered by Supabase pg_cron every 6 hours to submit
 * unindexed articles to multiple search engine indexing APIs.
 *
 * APIs Used:
 * 1. Google Indexing API - Requests crawling (200 requests/day quota)
 * 2. IndexNow API - Instant notification to Bing/Yandex (unlimited)
 *
 * Workflow:
 * 1. Query unindexed articles (status: pending or failed with < 3 attempts)
 * 2. Build full URLs for each article
 * 3. Submit URLs to both APIs simultaneously
 * 4. Update status to 'submitted' if ANY API succeeds
 *
 * IMPORTANT: 'submitted' status means at least one API accepted the request,
 * NOT that the page is actually indexed. Use /api/cron/verify-indexing to check
 * actual Google indexing status via URL Inspection API.
 *
 * Benefits of dual submission:
 * - Google: Better for Google Search visibility (verified later)
 * - IndexNow: Instant indexing on Bing/Yandex, no quota limits
 *
 * Security:
 * - Validates CRON_SECRET header to prevent unauthorized access
 * - Uses Supabase admin client to bypass RLS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnindexedArticles, updateArticleIndexingStatus } from '@/lib/supabase';
import { batchSubmitUrls } from '@/lib/google-indexing';
import { batchSubmitToIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes timeout for cron job

// Base URL for constructing article URLs
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowtra.store';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Optional: Validate cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Only validate if CRON_SECRET is explicitly set
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron Submit Indexing] Unauthorized request - invalid CRON_SECRET');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron Submit Indexing] Starting cron job...');

    // Step 1: Get unindexed articles
    const unindexedArticles = await getUnindexedArticles();

    if (unindexedArticles.length === 0) {
      console.log('[Cron Submit Indexing] No articles to index. Exiting.');
      return NextResponse.json({
        success: true,
        message: 'No articles to index',
        stats: {
          total: 0,
          successful: 0,
          failed: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    console.log(`[Cron Submit Indexing] Found ${unindexedArticles.length} unindexed articles`);

    // Step 2: Build full URLs
    const articleUrls = unindexedArticles.map(article => ({
      id: article.id,
      slug: article.slug,
      url: `${BASE_URL}/blog/${article.slug}`,
    }));

    // Step 3: Submit URLs to both APIs
    const urls = articleUrls.map(a => a.url);

    console.log('[Cron Submit Indexing] Submitting to Google Indexing API...');
    const googleSubmissionPromise = batchSubmitUrls(
      urls,
      200 // 200ms delay between requests to respect rate limits
    );

    console.log('[Cron Submit Indexing] Submitting to IndexNow API...');
    const indexNowSubmissionPromise = batchSubmitToIndexNow(urls);

    // Wait for both APIs to complete
    const [googleResult, indexNowResult] = await Promise.all([
      googleSubmissionPromise,
      indexNowSubmissionPromise,
    ]);

    console.log('[Cron Submit Indexing] API Results:');
    console.log(`  - Google: ${googleResult.successful}/${googleResult.total} successful`);
    console.log(`  - IndexNow: ${indexNowResult.successful}/${indexNowResult.total} successful`);

    // Step 4: Update database with results
    console.log('[Cron Submit Indexing] Updating database with submission results...');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < articleUrls.length; i++) {
      const article = articleUrls[i];
      const googleSuccess = googleResult.results[i]?.success || false;
      const indexNowSuccess = indexNowResult.successful > 0; // IndexNow submits all URLs in batch

      // Mark as submitted if ANY API succeeded
      const anySuccess = googleSuccess || indexNowSuccess;

      try {
        if (anySuccess) {
          await updateArticleIndexingStatus(article.id, 'submitted');
          successCount++;

          // Log which APIs succeeded
          const apis = [];
          if (googleSuccess) apis.push('Google');
          if (indexNowSuccess) apis.push('IndexNow');
          console.log(`✅ [Cron Submit Indexing] Submitted via ${apis.join(' + ')}: ${article.slug}`);
        } else {
          // Both APIs failed
          const errors = [];
          if (googleResult.results[i]?.error) errors.push(`Google: ${googleResult.results[i].error}`);
          if (indexNowResult.failed > 0) errors.push('IndexNow failed');

          const combinedError = errors.join('; ');
          await updateArticleIndexingStatus(article.id, 'failed', combinedError);
          failCount++;
          console.error(`❌ [Cron Submit Indexing] Both APIs failed for ${article.slug}: ${combinedError}`);
        }
      } catch (dbError: unknown) {
        console.error(`[Cron Submit Indexing] Database update error for ${article.slug}:`, dbError);
        failCount++;
      }
    }

    const duration = Date.now() - startTime;
    const stats = {
      total: unindexedArticles.length,
      successful: successCount,
      failed: failCount,
      duration,
      apiResults: {
        google: {
          successful: googleResult.successful,
          failed: googleResult.failed,
        },
        indexNow: {
          successful: indexNowResult.successful,
          failed: indexNowResult.failed,
        },
      },
    };

    console.log('[Cron Submit Indexing] Cron job completed successfully:', stats);

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.total} articles: ${stats.successful} successful, ${stats.failed} failed`,
      stats,
      articles: articleUrls.map(a => ({ slug: a.slug, url: a.url })),
    });

  } catch (error: unknown) {
    console.error('[Cron Submit Indexing] Fatal error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check and manual trigger (optional)
 */
export async function GET(request: NextRequest) {
  // Optional: Validate cron secret if configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Only validate if CRON_SECRET is explicitly set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // For manual triggers, redirect to POST
  return POST(request);
}
