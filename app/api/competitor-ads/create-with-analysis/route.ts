import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { parseCompetitorTimeline } from '@/lib/competitor-shots';
import { toPersistedAnalysisV2 } from '@/lib/video-analysis-schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes for large video uploads
export const experimental_bodySizeLimit = 100 * 1024 * 1024; // 100MB limit for video uploads

/**
 * POST /api/competitor-ads/create-with-analysis
 *
 * Creates a competitor ad record with pre-analyzed results.
 * Used when analysis is done before submission (preview mode).
 *
 * Expects JSON with:
 * - competitor_name: string
 * - analysis_result: object
 * - language: string
 * - analysis_status: string
 * - source_storage_bucket?: string
 * - source_storage_path?: string
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      competitor_name: competitorName,
      analysis_result: analysisResult,
      language,
      analysis_status: analysisStatus,
      source_storage_bucket: sourceStorageBucket,
      source_storage_path: sourceStoragePath
    } = body;

    console.log('[POST /api/competitor-ads/create-with-analysis] Received params:', {
      competitorName,
      language,
      analysisStatus,
      userId
    });

    if (!competitorName || (typeof competitorName === 'string' && competitorName.trim().length === 0)) {
      return NextResponse.json({ error: 'Competitor name is required' }, { status: 400 });
    }

    if (!analysisResult || typeof analysisResult !== 'object') {
      return NextResponse.json({ error: 'Analysis result is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    console.log(`[POST /api/competitor-ads/create-with-analysis] Creating competitor ad with pre-analyzed results: ${competitorName}`);

    // Optional source storage refs may be provided when the analyzed file is retained.
    // Analysis data remains the primary payload stored for competitor ads.

    const persistedAnalysis = toPersistedAnalysisV2(analysisResult as Record<string, unknown>);
    if (!persistedAnalysis) {
      return NextResponse.json({ error: 'Invalid analysis result' }, { status: 400 });
    }

    // Parse timeline for video duration
    const timeline = parseCompetitorTimeline(persistedAnalysis as unknown as Record<string, unknown>);

    // Create competitor ad record with analysis results (NO file storage)
    const { data: competitorAd, error: dbError } = await supabase
      .from('competitor_ads')
      .insert({
        user_id: userId,
        competitor_name: competitorName.trim(),
        analysis_status: analysisStatus || 'completed',
        analysis_result: persistedAnalysis,
        language: language || 'en',
        analyzed_at: new Date().toISOString(),
        video_duration_seconds: timeline.videoDurationSeconds,
        source_storage_bucket: typeof sourceStorageBucket === 'string' ? sourceStorageBucket : null,
        source_storage_path: typeof sourceStoragePath === 'string' ? sourceStoragePath : null
      })
      .select()
      .single();

    if (dbError) {
      console.error('[POST /api/competitor-ads/create-with-analysis] Database insert error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create competitor ad', details: dbError.message },
        { status: 500 }
      );
    }

    console.log(`[POST /api/competitor-ads/create-with-analysis] ✅ Competitor ad ${competitorAd.id} created successfully`);

    return NextResponse.json({
      success: true,
      competitorAd
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/competitor-ads/create-with-analysis] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
