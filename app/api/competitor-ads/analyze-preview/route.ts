import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeCompetitorAdWithLanguage } from '@/lib/competitor-ugc-replication-workflow';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // Increase execution timeout to 60s for large uploads

/**
 * POST /api/competitor-ads/analyze-preview
 *
 * Analyzes a competitor ad file WITHOUT creating a database record.
 * Used for preview/auto-fill functionality before user submits.
 *
 * Expects multipart/form-data with:
 * - ad_file: File (image or video)
 * - file_url: string (public URL of the uploaded file)
 * - file_type: 'image' | 'video'
 * - competitor_name: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const adFile = formData.get('ad_file') as File | null;
    const competitorName = (formData.get('competitor_name') as string) || '';

    // Validation
    if (!adFile) {
      return NextResponse.json(
        { error: 'ad_file is required' },
        { status: 400 }
      );
    }

    // Video-only validation
    if (!adFile.type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Only video files are supported for competitor ads' },
        { status: 400 }
      );
    }

    // Upload file temporarily to Supabase storage for analysis
    console.log(`[POST /api/competitor-ads/analyze-preview] Uploading video temporarily for analysis...`);

    const fileName = `temp_${userId}_${Date.now()}_${adFile.name}`;
    const fileBuffer = Buffer.from(await adFile.arrayBuffer());

    const supabase = getSupabaseAdmin();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('competitor_videos')
      .upload(fileName, fileBuffer, {
        contentType: adFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error('[POST /api/competitor-ads/analyze-preview] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file for analysis', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL for analysis
    const { data: { publicUrl } } = supabase.storage
      .from('competitor_videos')
      .getPublicUrl(fileName);

    console.log(`[POST /api/competitor-ads/analyze-preview] Starting analysis for video...`);

    // Perform AI analysis (competitor ads are video-only now)
    try {
      const { analysis, language } = await analyzeCompetitorAdWithLanguage({
        file_url: publicUrl,
        competitor_name: competitorName
      });

      console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Analysis complete, language: ${language}`);

      // Delete temporary file after successful analysis
      try {
        await supabase.storage
          .from('competitor_videos')
          .remove([fileName]);
        console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Temporary file deleted: ${fileName}`);
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
          .remove([fileName]);
        console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Temporary file deleted after error: ${fileName}`);
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
