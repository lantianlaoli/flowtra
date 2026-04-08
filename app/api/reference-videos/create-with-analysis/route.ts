import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { parseReferenceVideoTimeline } from '@/lib/reference-video-shots';
import { toPersistedAnalysisV2 } from '@/lib/video-analysis-schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes for large video uploads
export const experimental_bodySizeLimit = 100 * 1024 * 1024; // 100MB limit for video uploads

/**
 * POST /api/reference-videos/create-with-analysis
 *
 * Creates a reference video record with pre-analyzed results.
 * Used when analysis is done before submission (preview mode).
 *
 * Expects JSON with:
 * - reference_name: string
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
      reference_name: referenceName,
      analysis_result: analysisResult,
      language,
      analysis_status: analysisStatus,
      source_storage_bucket: sourceStorageBucket,
      source_storage_path: sourceStoragePath
    } = body;

    console.log('[POST /api/reference-videos/create-with-analysis] Received params:', {
      referenceName,
      language,
      analysisStatus,
      userId
    });

    if (!referenceName || (typeof referenceName === 'string' && referenceName.trim().length === 0)) {
      return NextResponse.json({ error: 'Reference video name is required' }, { status: 400 });
    }

    if (!analysisResult || typeof analysisResult !== 'object') {
      return NextResponse.json({ error: 'Analysis result is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    console.log(`[POST /api/reference-videos/create-with-analysis] Creating reference video with pre-analyzed results: ${referenceName}`);

    // Optional source storage refs may be provided when the analyzed file is retained.
    // Analysis data remains the primary payload stored for reference videos.

    const persistedAnalysis = toPersistedAnalysisV2(analysisResult as Record<string, unknown>);
    if (!persistedAnalysis) {
      return NextResponse.json({ error: 'Invalid analysis result' }, { status: 400 });
    }

    // Parse timeline for video duration
    const timeline = parseReferenceVideoTimeline(persistedAnalysis as unknown as Record<string, unknown>);

    // Create reference video record with analysis results (NO file storage)
    const { data: referenceVideo, error: dbError } = await supabase
      .from('reference_videos')
      .insert({
        user_id: userId,
        reference_name: referenceName.trim(),
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
      console.error('[POST /api/reference-videos/create-with-analysis] Database insert error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create reference video', details: dbError.message },
        { status: 500 }
      );
    }

    console.log(`[POST /api/reference-videos/create-with-analysis] ✅ Reference video ${referenceVideo.id} created successfully`);

    return NextResponse.json({
      success: true,
      referenceVideo
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/reference-videos/create-with-analysis] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
