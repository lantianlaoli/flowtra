import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { parseReferenceVideoTimeline } from '@/lib/reference-video-shots';
import { analyzeReferenceVideoWithRetry } from '@/lib/reference-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/reference-videos/[id]/reanalyze
 *
 * Re-analyze a reference video that previously failed analysis.
 * This endpoint is typically called when a reference video has analysis_status='failed'
 * and the user clicks the "Retry Analysis" button.
 *
 * Flow:
 * 1. Verify user owns the reference video
 * 2. Check that the record exists and has required fields
 * 3. Mark status as 'analyzing'
 * 4. Call AI analysis function
 * 5. Update with results or mark as failed again
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Reference video ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the reference video and verify ownership
    const { data: referenceVideo, error: fetchError } = await supabase
      .from('reference_videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !referenceVideo) {
      console.error(`[POST /api/reference-videos/${id}/reanalyze] Fetch error:`, fetchError);
      return NextResponse.json(
        { error: 'Reference video not found or access denied' },
        { status: 404 }
      );
    }

    // Verify required fields exist
    if (!referenceVideo.ad_file_url || !referenceVideo.file_type) {
      return NextResponse.json(
        { error: 'Reference video is missing required file information' },
        { status: 400 }
      );
    }

    console.log(`[POST /api/reference-videos/${id}/reanalyze] Starting re-analysis for ${referenceVideo.reference_name}...`);

    // Mark as analyzing
    const { error: updateStatusError } = await supabase
      .from('reference_videos')
      .update({
        analysis_status: 'analyzing',
        analysis_error: null // Clear previous error
      })
      .eq('id', id);

    if (updateStatusError) {
      console.error(`[POST /api/reference-videos/${id}/reanalyze] Failed to update status:`, updateStatusError);
      return NextResponse.json(
        { error: 'Failed to start re-analysis', details: updateStatusError.message },
        { status: 500 }
      );
    }

    // Perform AI analysis with language detection
    try {
      const { analysis, language } = await analyzeReferenceVideoWithRetry({
        file_url: referenceVideo.ad_file_url,
        file_type: referenceVideo.file_type as 'video' | 'image',
        reference_name: referenceVideo.reference_name
      }, { loggerPrefix: `POST /api/reference-videos/${id}/reanalyze` });
      const timeline = parseReferenceVideoTimeline(analysis);

      console.log(`[POST /api/reference-videos/${id}/reanalyze] ✅ Analysis complete, language: ${language}`);

      // Update with successful analysis
      const { data: updatedAd, error: updateError } = await supabase
        .from('reference_videos')
        .update({
          analysis_result: analysis,
          language: language,
          analysis_status: 'completed',
          analysis_error: null,
          analyzed_at: new Date().toISOString(),
          video_duration_seconds: timeline.videoDurationSeconds
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error(`[POST /api/reference-videos/${id}/reanalyze] Failed to update results:`, updateError);
        // Mark as failed since we can't save the results
        await supabase
          .from('reference_videos')
          .update({
            analysis_status: 'failed',
            analysis_error: `Update failed: ${updateError.message}`
          })
          .eq('id', id);

        return NextResponse.json(
          { error: 'Analysis succeeded but failed to save results', details: updateError.message },
          { status: 500 }
        );
      }

      console.log(`[POST /api/reference-videos/${id}/reanalyze] ✅ Re-analysis successful`);
      return NextResponse.json({ success: true, referenceVideo: updatedAd }, { status: 200 });

    } catch (analysisError) {
      console.error(`[POST /api/reference-videos/${id}/reanalyze] ❌ Analysis failed:`, analysisError);

      const errorMessage = analysisError instanceof Error ? analysisError.message : 'Unknown analysis error';

      // Mark as failed again
      const { data: failedAd, error: markFailedError } = await supabase
        .from('reference_videos')
        .update({
          analysis_status: 'failed',
          analysis_error: errorMessage
        })
        .eq('id', id)
        .select()
        .single();

      if (markFailedError) {
        console.error(`[POST /api/reference-videos/${id}/reanalyze] Failed to mark as failed:`, markFailedError);
        return NextResponse.json(
          { error: 'Re-analysis failed', details: errorMessage },
          { status: 500 }
        );
      }

      console.log(`[POST /api/reference-videos/${id}/reanalyze] ⚠️ Re-analysis failed, marked as failed`);
      return NextResponse.json({
        success: true,
        referenceVideo: failedAd,
        warning: 'Re-analysis failed. You can try again later.'
      }, { status: 200 });
    }

  } catch (error) {
    console.error(`[POST /api/reference-videos/[id]/reanalyze] Unexpected error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
