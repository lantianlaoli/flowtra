import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeCompetitorAdWithLanguage } from '@/lib/standard-ads-workflow';

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
    const fileUrl = formData.get('file_url') as string;
    const fileType = formData.get('file_type') as 'image' | 'video';
    const competitorName = (formData.get('competitor_name') as string) || '';

    // Validation
    if (!fileUrl || !fileType) {
      return NextResponse.json(
        { error: 'file_url and file_type are required' },
        { status: 400 }
      );
    }

    if (!['image', 'video'].includes(fileType)) {
      return NextResponse.json(
        { error: 'file_type must be either "image" or "video"' },
        { status: 400 }
      );
    }

    console.log(`[POST /api/competitor-ads/analyze-preview] Starting analysis for ${fileType}...`);

    // Perform AI analysis
    try {
      const { analysis, language } = await analyzeCompetitorAdWithLanguage({
        file_url: fileUrl,
        file_type: fileType,
        competitor_name: competitorName
      });

      console.log(`[POST /api/competitor-ads/analyze-preview] ✅ Analysis complete, language: ${language}`);

      return NextResponse.json({
        success: true,
        analysis,
        language
      }, { status: 200 });

    } catch (analysisError) {
      console.error(`[POST /api/competitor-ads/analyze-preview] ❌ Analysis failed:`, analysisError);

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
