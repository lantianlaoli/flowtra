import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeReferenceVideoWithLanguage } from '@/lib/video-clone-workflow';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchTikTokVideoUrl, TikTokFetchError } from '@/lib/fetch-tiktok-video';
import { STORAGE_BUCKETS } from '@/lib/storage/types';
import { analysisToLegacyFlatShots, buildAudioSummary } from '@/lib/video-analysis-schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes for large video analysis
export const experimental_bodySizeLimit = 50 * 1024 * 1024; // 50MB limit for video uploads

/**
 * POST /api/reference-videos/analyze-preview
 *
 * Analyzes a reference video file WITHOUT creating a database record.
 * Used for preview/auto-fill functionality before user submits.
 *
 * Expects JSON with ONE of:
 * - file_url + uploaded_path: For uploaded files (existing flow)
 * - tiktok_url: For TikTok videos (new flow)
 *
 * Common parameters:
 * - reference_name: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { file_url, uploaded_path, tiktok_url, is_external_url, reference_name = '' } = body;

    // Allow unauthenticated users ONLY for TikTok URL mode or External URL mode (which comes from TikTok)
    if (!userId) {
      // File upload mode requires authentication
      if (!tiktok_url && !is_external_url) {
        return NextResponse.json(
          { error: 'Authentication required for file uploads' },
          { status: 401 }
        );
      }
      // TikTok/External mode: Continue without userId
    }

    // Validation: Must provide exactly ONE of file_url or tiktok_url
    if (!file_url && !tiktok_url) {
      return NextResponse.json(
        { error: 'Either file_url or tiktok_url is required' },
        { status: 400 }
      );
    }

    if (file_url && tiktok_url) {
      return NextResponse.json(
        { error: 'Cannot provide both file_url and tiktok_url. Choose one method.' },
        { status: 400 }
      );
    }

    // File upload mode: require uploaded_path for cleanup (unless external URL)
    if (file_url && !uploaded_path && !is_external_url) {
      return NextResponse.json(
        { error: 'uploaded_path is required when using file_url (unless is_external_url is true)' },
        { status: 400 }
      );
    }

    console.log(`[POST /api/reference-videos/analyze-preview] Starting analysis...`);

    // Determine video URL and cleanup method
    let videoUrl: string;
    let needsFileCleanup = false;
    let cleanupPath: string | null = null;

    // MODE 1: TikTok URL
    if (tiktok_url) {
      console.log(`[POST /api/reference-videos/analyze-preview] Mode: TikTok URL`);
      console.log(`[POST /api/reference-videos/analyze-preview] TikTok URL: ${tiktok_url}`);

      try {
        // Fetch TikTok CDN URL via RapidAPI
        videoUrl = await fetchTikTokVideoUrl(tiktok_url);
        console.log(`[POST /api/reference-videos/analyze-preview] ✅ TikTok CDN URL fetched`);
      } catch (error) {
        if (error instanceof TikTokFetchError) {
          console.error(`[POST /api/reference-videos/analyze-preview] ❌ TikTok fetch failed:`, error.message);
          return NextResponse.json(
            {
              success: false,
              error: error.message
            },
            { status: error.statusCode || 500 }
          );
        }
        throw error; // Re-throw unexpected errors
      }
    }
    // MODE 2: File URL (Upload or External)
    else {
      console.log(`[POST /api/reference-videos/analyze-preview] Mode: File URL (${is_external_url ? 'External' : 'Upload'})`);
      console.log(`[POST /api/reference-videos/analyze-preview] File URL: ${file_url}`);

      videoUrl = file_url;
      
      // Only cleanup if it's a user upload
      if (!is_external_url) {
        needsFileCleanup = true;
        cleanupPath = uploaded_path;
      }
    }

    // Perform AI analysis (reference videos are video-only now)
    const supabase = getSupabaseAdmin();
    try {
      const { analysis, language } = await analyzeReferenceVideoWithLanguage({
        file_url: videoUrl,
        reference_name: reference_name
      });
      const previewAnalysis = {
        name: typeof analysis.name === 'string' ? analysis.name : '',
        detected_language: typeof analysis.detected_language === 'string' ? analysis.detected_language : language,
        video_duration_seconds: typeof analysis.video_duration_seconds === 'number' ? analysis.video_duration_seconds : 0,
        shots: analysisToLegacyFlatShots(analysis).map(shot => ({
          ...shot,
          audio: buildAudioSummary({
            dialogue: shot.dialogue || '',
            sfx: shot.sfx || '',
            ambient: shot.ambient || ''
          })
        }))
      };

      console.log(`[POST /api/reference-videos/analyze-preview] ✅ Analysis complete, language: ${language}`);

      // Delete temporary file after successful analysis (file upload mode only)
      if (needsFileCleanup && cleanupPath) {
        try {
          await supabase.storage
            .from(STORAGE_BUCKETS.tempUploads)
            .remove([cleanupPath]);
          console.log(`[POST /api/reference-videos/analyze-preview] ✅ Temporary file deleted: ${cleanupPath}`);
        } catch (deleteError) {
          console.warn(`[POST /api/reference-videos/analyze-preview] ⚠️ Failed to delete temporary file:`, deleteError);
          // Continue anyway - file will be cleaned up later
        }
      }

      return NextResponse.json({
        success: true,
        analysis: previewAnalysis,
        language,
        video_url: tiktok_url ? videoUrl : undefined // Return CDN URL for TikTok preview
      }, { status: 200 });

    } catch (analysisError) {
      console.error(`[POST /api/reference-videos/analyze-preview] ❌ Analysis failed:`, analysisError);

      // Delete temporary file on analysis failure (file upload mode only)
      if (needsFileCleanup && cleanupPath) {
        try {
          await supabase.storage
            .from(STORAGE_BUCKETS.tempUploads)
            .remove([cleanupPath]);
          console.log(`[POST /api/reference-videos/analyze-preview] ✅ Temporary file deleted after error: ${cleanupPath}`);
        } catch (deleteError) {
          console.warn(`[POST /api/reference-videos/analyze-preview] ⚠️ Failed to delete temporary file after error:`, deleteError);
        }
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
    console.error('[POST /api/reference-videos/analyze-preview] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
