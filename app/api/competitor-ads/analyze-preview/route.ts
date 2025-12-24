import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeCompetitorAdWithLanguage } from '@/lib/competitor-ugc-replication-workflow';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes for large video analysis
export const experimental_bodySizeLimit = 50 * 1024 * 1024; // 50MB limit for video uploads

/**
 * POST /api/competitor-ads/analyze-preview
 *
 * Analyzes a competitor ad file WITHOUT creating a database record.
 * Used for preview/auto-fill functionality before user submits.
 *
 * Expects JSON with:
 * - file_url: string (public URL of the uploaded file in Supabase)
 * - uploaded_path: string (path in Supabase storage for cleanup)
 * - competitor_name: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { file_url, uploaded_path, competitor_name = '' } = body;

    // Validation
    if (!file_url) {
      return NextResponse.json(
        { error: 'file_url is required' },
        { status: 400 }
      );
    }

    if (!uploaded_path) {
      return NextResponse.json(
        { error: 'uploaded_path is required' },
        { status: 400 }
      );
    }

    console.log(`[POST /api/competitor-ads/analyze-preview] Starting analysis for video...`);
    console.log(`[POST /api/competitor-ads/analyze-preview] File URL: ${file_url}`);

    // Perform AI analysis (competitor ads are video-only now)
    const supabase = getSupabaseAdmin();
    try {
      const { analysis, language } = await analyzeCompetitorAdWithLanguage({
        file_url: file_url,
        competitor_name: competitor_name
      });

      console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Analysis complete, language: ${language}`);

      // Delete temporary file after successful analysis
      try {
        await supabase.storage
          .from('competitor_videos')
          .remove([uploaded_path]);
        console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Temporary file deleted: ${uploaded_path}`);
      } catch (deleteError) {
        console.warn(`[POST /api/competitor-ads/analyze-preview] ⚠️ Failed to delete temporary file:`, deleteError);
        // Continue anyway - file will be cleaned up later
      }

      return NextResponse.json({
        success: true,
        analysis,
        language
      }, { status: 200 });

    } catch (analysisError) {
      console.error(`[POST /api/competitor-ads/analyze-preview] ❌ Analysis failed:`, analysisError);

      // Delete temporary file on analysis failure
      try {
        await supabase.storage
          .from('competitor_videos')
          .remove([uploaded_path]);
        console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Temporary file deleted after error: ${uploaded_path}`);
      } catch (deleteError) {
        console.warn(`[POST /api/competitor-ads/analyze-preview] ⚠️ Failed to delete temporary file after error:`, deleteError);
      }

      const errorMessage = analysisError instanceof Error
        ? analysisError.message
        : 'Unknown analysis error';

      return NextResponse.json({
        success: false,
        error: 'Analysis failed',
        details: errorMessage
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[POST /api/competitor-ads/analyze-preview] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
