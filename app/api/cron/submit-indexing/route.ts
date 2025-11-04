/**
 * Google Indexing API Cron Job
 *
 * This endpoint is triggered by Supabase pg_cron every 6 hours to submit
 * unindexed articles to Google Search Console Indexing API.
 *
 * Workflow:
 * 1. Query unindexed articles (status: pending or failed with < 3 attempts)
 * 2. Build full URLs for each article
 * 3. Submit URLs to Google Indexing API
 * 4. Update indexing status in database
 *
 * Security:
 * - Validates CRON_SECRET header to prevent unauthorized access
 * - Uses Supabase admin client to bypass RLS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnindexedArticles, updateArticleIndexingStatus } from '@/lib/supabase';
import { batchSubmitUrls } from '@/lib/google-indexing';

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

    // Step 3: Submit URLs to Google Indexing API
    console.log('[Cron Submit Indexing] Submitting URLs to Google Indexing API...');
    const submissionResult = await batchSubmitUrls(
      articleUrls.map(a => a.url),
      200 // 200ms delay between requests
    );

    // Step 4: Update database with results
    console.log('[Cron Submit Indexing] Updating database with submission results...');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < submissionResult.results.length; i++) {
      const result = submissionResult.results[i];
      const article = articleUrls[i];

      try {
        if (result.success) {
          await updateArticleIndexingStatus(article.id, 'success');
          successCount++;
          console.log(`✅ [Cron Submit Indexing] Success: ${article.slug}`);
        } else {
          await updateArticleIndexingStatus(article.id, 'failed', result.error);
          failCount++;
          console.error(`❌ [Cron Submit Indexing] Failed: ${article.slug} - ${result.error}`);
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
