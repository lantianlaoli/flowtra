import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getDownloadCost, isFreeGenerationModel } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Support both JSON and FormData (form submit)
    const contentType = request.headers.get('content-type') || '';
    let historyId: string;
    let validateOnly: boolean | undefined;

    if (contentType.includes('application/json')) {
      // JSON format (validation request)
      const body = await request.json();
      historyId = body.historyId;
      validateOnly = body.validateOnly;
      // videoDurationSeconds from body is not used - duration comes from project record
    } else {
      // FormData format (form submit download)
      const formData = await request.formData();
      historyId = formData.get('historyId') as string;
      validateOnly = formData.get('validateOnly') === 'true';
      // videoDurationSeconds from formData is not used - duration comes from project record
    }

    if (!historyId) {
      return NextResponse.json({ error: 'Missing historyId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get the character ads project
    const { data: project, error: projectError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', historyId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      console.error('Character ads project not found:', { historyId, userId, error: projectError });
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }


    // Check if project has downloadable video
    // Accept single generated video when only one scene is generated (8s for VEO*, 10s for Sora2)
    let videoUrl = project.merged_video_url;
    const unitSeconds = (project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : project.video_model) === 'sora2' ? 10 : 8;
    const totalScenes = (project.video_duration_seconds || 8) / unitSeconds;
    if (!videoUrl && totalScenes === 1 && project.generated_video_urls?.length > 0) {
      videoUrl = project.generated_video_urls[0];
    }

    if (project.status !== 'completed' || !videoUrl) {
      console.error('Video not ready for download:', {
        status: project.status,
        hasVideoUrl: !!videoUrl,
        mergedVideoUrl: project.merged_video_url,
        generatedVideos: project.generated_video_urls?.length || 0
      });
      return NextResponse.json({
        error: 'Video not ready for download',
        status: project.status,
        hasVideo: !!videoUrl
      }, { status: 400 });
    }

    // ===== VERSION 3.0: MIXED BILLING - Download Phase =====
    // FREE generation models (veo3_fast, sora2): Charge at download
    // PAID generation models (veo3, sora2_pro): Download is FREE (already paid at generation)
    const isFirstDownload = !project.downloaded;
    const videoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';

    if (isFirstDownload) {
      // Check if this model has download cost (free-generation models)
      if (isFreeGenerationModel(videoModel)) {
        const downloadCost = getDownloadCost(videoModel);

        // Check if user has enough credits
        const creditCheck = await checkCredits(userId, downloadCost);
        if (!creditCheck.hasEnoughCredits) {
          return NextResponse.json({
            error: `Insufficient credits. Need ${downloadCost} credits, have ${creditCheck.currentCredits}`
          }, { status: 402 });
        }

        // ✅ VALIDATE-ONLY MODE: If validateOnly=true, return success without downloading
        if (validateOnly) {
          return NextResponse.json({
            success: true,
            message: 'Validation successful',
            downloadCost: downloadCost
          }, { status: 200 });
        }

        // Deduct download cost
        const deductResult = await deductCredits(userId, downloadCost);
        if (!deductResult.success) {
          return NextResponse.json({
            error: 'Failed to deduct credits for download'
          }, { status: 500 });
        }

        // Record credit transaction
        await recordCreditTransaction(
          userId,
          'usage',
          downloadCost,
          `Character Ads - Downloaded video (${videoModel.toUpperCase()})`,
          historyId
        );

        console.log(`[Download Billing] Charged ${downloadCost} credits for ${videoModel} download (user: ${userId})`);
      } else if (validateOnly) {
        // Paid-generation model + validate-only: just return success
        return NextResponse.json({
          success: true,
          message: 'Validation successful (already paid)',
          downloadCost: 0
        }, { status: 200 });
      }
      // If paid-generation model, download is FREE (no credit deduction)

      // Mark project as downloaded
      const { error: updateError } = await supabase
        .from('character_ads_projects')
        .update({
          downloaded: true
        })
        .eq('id', historyId);

      if (updateError) {
        console.error('Failed to mark project as downloaded:', updateError);
        // Don't fail the download, just log the error
      }
    } else if (validateOnly) {
      // Already downloaded + validate-only: return success
      return NextResponse.json({
        success: true,
        message: 'Validation successful (already downloaded)',
        downloadCost: 0
      }, { status: 200 });
    }

    // Stream the video file directly to the client (instant download start)
    // videoUrl is already determined above based on video duration and available videos

    try {
      const videoResponse = await fetchWithRetry(videoUrl, {}, 3, 30000); // 3 retries, 30s timeout

      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      // Stream video directly without buffering
      return new NextResponse(videoResponse.body, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="flowtra-character-ads-${historyId}.mp4"`,
          'Content-Length': videoResponse.headers.get('content-length') || '',
        },
      });

    } catch (fetchError) {
      console.error('Failed to download video file:', fetchError);
      return NextResponse.json({
        error: 'Failed to download video file',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Character ads download error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
