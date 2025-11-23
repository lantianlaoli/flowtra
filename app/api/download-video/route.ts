import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';
import { getDownloadCost, getSegmentCountFromDuration, isFreeGenerationModel } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

interface DownloadVideoRequest {
  historyId: string;
  userId: string;
}

interface DownloadVideoResponse {
  success: boolean;
  message: string;
  downloadUrl?: string;
  remainingCredits?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DownloadVideoResponse>> {
  try {
    // Support both JSON and FormData (form submit)
    const contentType = request.headers.get('content-type') || '';
    let historyId: string;
    let userId: string;
    let validateOnly: boolean | undefined;

    if (contentType.includes('application/json')) {
      // JSON format (validation request)
      const body: DownloadVideoRequest & { validateOnly?: boolean } = await request.json();
      historyId = body.historyId;
      userId = body.userId;
      validateOnly = body.validateOnly;
    } else {
      // FormData format (form submit download)
      const formData = await request.formData();
      historyId = formData.get('historyId') as string;
      userId = formData.get('userId') as string;
      validateOnly = formData.get('validateOnly') === 'true';
    }

    if (!historyId || !userId) {
      return NextResponse.json({
        success: false,
        message: 'History ID and User ID are required'
      }, { status: 400 });
    }

    // Get the history record
    const supabase = getSupabase();
    const { data: historyRecord, error: historyError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .eq('id', historyId)
      .eq('user_id', userId)
      .single();

    if (historyError || !historyRecord) {
      return NextResponse.json({
        success: false,
        message: 'Video record not found'
      }, { status: 404 });
    }

    // Check if video generation is completed
    if (historyRecord.status !== 'completed' || !historyRecord.video_url) {
      return NextResponse.json({
        success: false,
        message: 'Video generation not completed yet'
      }, { status: 400 });
    }

    // ===== VERSION 3.0: MIXED BILLING - Download Phase =====
    // FREE generation models (veo3_fast, sora2): Charge at download
    // PAID generation models (veo3, sora2_pro): Download is FREE (already paid at generation)
    const isFirstDownload = !historyRecord.downloaded;
    const videoModel = historyRecord.video_model as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';

    let downloadCostApplied = 0;

    if (isFirstDownload) {
      // Check if this model has download cost (free-generation models)
      if (isFreeGenerationModel(videoModel)) {
        const segments = historyRecord.is_segmented
          ? historyRecord.segment_count || getSegmentCountFromDuration(historyRecord.video_duration, videoModel)
          : undefined;
        const downloadCost = getDownloadCost(videoModel, historyRecord.video_duration, segments);
        downloadCostApplied = downloadCost;

        // Check if user has enough credits
        const creditCheck = await checkCredits(userId, downloadCost);
        if (!creditCheck.hasEnoughCredits) {
          return NextResponse.json({
            success: false,
            message: `Insufficient credits. Need ${downloadCost} credits, have ${creditCheck.currentCredits}`
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
            success: false,
            message: 'Failed to deduct credits for download'
          }, { status: 500 });
        }

        // Record credit transaction
        await recordCreditTransaction(
          userId,
          'usage',
          -downloadCost,
          `Standard Ads - Downloaded video (${videoModel.toUpperCase()})`,
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

      // Mark as downloaded
      const { error: updateError } = await supabase
        .from('standard_ads_projects')
        .update({
          downloaded: true,
          download_credits_used: downloadCostApplied,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', historyId);

      if (updateError) {
        console.error('Failed to update history record:', updateError);
        return NextResponse.json({
          success: false,
          message: 'Failed to update download record'
        }, { status: 500 });
      }
    } else if (validateOnly) {
      // Already downloaded + validate-only: return success
      return NextResponse.json({
        success: true,
        message: 'Validation successful (already downloaded)',
        downloadCost: 0
      }, { status: 200 });
    }

    // Stream the video file from the external URL directly to the client
    // This avoids loading the entire video in server memory, providing instant download start
    try {
      const videoResponse = await fetch(historyRecord.video_url);
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }

      // Stream video directly without buffering (instant download start)
      return new NextResponse(videoResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="flowtra-video-${historyId}.mp4"`,
          'Content-Length': videoResponse.headers.get('content-length') || '',
          'x-flowtra-download-cost': downloadCostApplied.toString(),
        },
      });
    } catch (downloadError) {
      console.error('Failed to download video:', downloadError);
      return NextResponse.json({
        success: false,
        message: 'Failed to download video file'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Download video error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
