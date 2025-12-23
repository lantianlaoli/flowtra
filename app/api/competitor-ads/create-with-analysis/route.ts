import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { parseCompetitorTimeline } from '@/lib/competitor-shots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // Increase execution timeout to 60s for large uploads

/**
 * POST /api/competitor-ads/create-with-analysis
 *
 * Creates a competitor ad record with pre-analyzed results.
 * Used when analysis is done before submission (preview mode).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const brandId = formData.get('brand_id') as string;
    const competitorName = formData.get('competitor_name') as string;
    const adFile = formData.get('ad_file') as File | null;
    const analysisResultStr = formData.get('analysis_result') as string;
    const language = formData.get('language') as string;
    const analysisStatus = formData.get('analysis_status') as string;

    console.log('[POST /api/competitor-ads/create-with-analysis] Received params:', {
      brandId,
      competitorName,
      hasAdFile: !!adFile,
      language,
      analysisStatus,
      userId
    });

    // Validation
    if (!brandId || brandId.trim().length === 0) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    if (!competitorName || competitorName.trim().length === 0) {
      return NextResponse.json({ error: 'Competitor name is required' }, { status: 400 });
    }

    if (!adFile) {
      return NextResponse.json({ error: 'Advertisement file is required' }, { status: 400 });
    }

    // NEW: Video-only validation
    if (!adFile.type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Only video files are supported for competitor ads' },
        { status: 400 }
      );
    }

    if (!analysisResultStr) {
      return NextResponse.json({ error: 'Analysis result is required' }, { status: 400 });
    }

    let analysisResult: Record<string, unknown>;
    try {
      analysisResult = JSON.parse(analysisResultStr);
    } catch {
      return NextResponse.json({ error: 'Invalid analysis result format' }, { status: 400 });
    }

    // Verify brand ownership
    const supabase = getSupabaseAdmin();
    const { data: brand, error: brandError } = await supabase
      .from('user_brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 });
    }

    console.log(`[POST /api/competitor-ads/create-with-analysis] Creating competitor ad with pre-analyzed results: ${competitorName}`);

    // NOTE: File is NOT uploaded to storage
    // File is only used temporarily for analysis, then discarded
    // Only analysis_result is stored in the database

    // Parse timeline for video duration
    const timeline = parseCompetitorTimeline(analysisResult);

    // Create competitor ad record with analysis results (NO file storage)
    const { data: competitorAd, error: dbError } = await supabase
      .from('competitor_ads')
      .insert({
        user_id: userId,
        brand_id: brandId,
        competitor_name: competitorName.trim(),
        analysis_status: analysisStatus || 'completed',
        analysis_result: analysisResult,
        language: language || 'en',
        analyzed_at: new Date().toISOString(),
        video_duration_seconds: timeline.videoDurationSeconds
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
