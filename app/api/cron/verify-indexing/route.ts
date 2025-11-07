/**
 * Google URL Inspection API Verification Cron Job
 *
 * This endpoint is triggered by Supabase pg_cron daily to verify actual
 * indexing status of articles that were submitted 3+ days ago.
 *
 * Workflow:
 * 1. Query articles with status 'submitted' that haven't been verified yet
 * 2. Use URL Inspection API to check actual indexing status
 * 3. Update status to 'verified_indexed' or 'verified_not_indexed'
 * 4. Store actual indexing state from Google Search Console
 *
 * IMPORTANT: This is the ONLY reliable way to verify if a page is actually
 * indexed by Google. The submission status ('submitted') only means the request
 * was sent, NOT that the page is indexed.
 *
 * Quota: URL Inspection API has 2,000 requests/day per property
 *
 * Security:
 * - Validates CRON_SECRET header to prevent unauthorized access
 * - Uses Supabase admin client to bypass RLS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getArticlesNeedingVerification, updateArticleVerificationStatus } from '@/lib/supabase';
import { checkActualIndexingStatus } from '@/lib/google-search-console';

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
      console.error('[Cron Verify Indexing] Unauthorized request - invalid CRON_SECRET');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron Verify Indexing] Starting verification job...');

    // Step 1: Get articles needing verification (submitted 3+ days ago)
    // Limit to 100 to stay within URL Inspection API daily quota (2000/day)
    const articlesToVerify = await getArticlesNeedingVerification(3, 100);

    if (articlesToVerify.length === 0) {
      console.log('[Cron Verify Indexing] No articles need verification. Exiting.');
      return NextResponse.json({
        success: true,
        message: 'No articles need verification',
        stats: {
          total: 0,
          indexed: 0,
          notIndexed: 0,
          failed: 0,
          duration: Date.now() - startTime,
        },
      });
    }

    console.log(`[Cron Verify Indexing] Found ${articlesToVerify.length} articles to verify`);

    // Step 2: Check each article's actual indexing status
    let indexedCount = 0;
    let notIndexedCount = 0;
    let failedCount = 0;

    const results = [];

    for (const article of articlesToVerify) {
      const url = `${BASE_URL}/blog/${article.slug}`;

      try {
        console.log(`[Cron Verify Indexing] Checking: ${article.slug}`);

        // Call URL Inspection API to check actual status
        const status = await checkActualIndexingStatus(url);

        if (status.error) {
          // API call failed (e.g., authentication error, quota exceeded)
          console.error(
            `❌ [Cron Verify Indexing] API error for ${article.slug}: ${status.error}`
          );
          failedCount++;
          results.push({
            slug: article.slug,
            url,
            status: 'api_error',
            error: status.error,
          });
          continue;
        }

        // Update database with verification result
        await updateArticleVerificationStatus(
          article.id,
          status.isIndexed,
          status.coverageState,
          status.error
        );

        if (status.isIndexed) {
          indexedCount++;
          console.log(`✅ [Cron Verify Indexing] INDEXED: ${article.slug}`);
          results.push({
            slug: article.slug,
            url,
            status: 'indexed',
            verdict: status.verdict,
            lastCrawlTime: status.lastCrawlTime,
          });
        } else {
          notIndexedCount++;
          console.log(`⚠️ [Cron Verify Indexing] NOT INDEXED: ${article.slug}`);
          results.push({
            slug: article.slug,
            url,
            status: 'not_indexed',
            verdict: status.verdict,
            coverageState: status.coverageState,
          });
        }

        // Add delay between requests to avoid rate limiting (500ms)
        if (articlesToVerify.indexOf(article) < articlesToVerify.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: unknown) {
        console.error(`[Cron Verify Indexing] Error checking ${article.slug}:`, error);
        failedCount++;
        results.push({
          slug: article.slug,
          url,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;
    const stats = {
      total: articlesToVerify.length,
      indexed: indexedCount,
      notIndexed: notIndexedCount,
      failed: failedCount,
      duration,
    };

    console.log('[Cron Verify Indexing] Verification job completed:', stats);

    return NextResponse.json({
      success: true,
      message: `Verified ${stats.total} articles: ${stats.indexed} indexed, ${stats.notIndexed} not indexed, ${stats.failed} failed`,
      stats,
      results,
    });
  } catch (error: unknown) {
    console.error('[Cron Verify Indexing] Fatal error:', error);

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
