import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';
import { getDownloadCost, isFreeGenerationModel } from '@/lib/constants';
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
    const { historyId, userId }: DownloadVideoRequest = await request.json();

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
    const videoModel = historyRecord.video_model as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';

    if (isFirstDownload) {
      // Check if this model has download cost (free-generation models)
      if (isFreeGenerationModel(videoModel)) {
        const downloadCost = getDownloadCost(videoModel);

        // Check if user has enough credits
        const creditCheck = await checkCredits(userId, downloadCost);
        if (!creditCheck.hasEnoughCredits) {
          return NextResponse.json({
            success: false,
            message: `Insufficient credits. Need ${downloadCost} credits, have ${creditCheck.currentCredits}`
          }, { status: 402 });
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
      }
      // If paid-generation model, download is FREE (no credit deduction)

      // Mark as downloaded
      const { error: updateError } = await supabase
        .from('standard_ads_projects')
        .update({
          downloaded: true,
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
    }

    // Fetch the video file from the external URL and return it directly
    try {
      const videoResponse = await fetch(historyRecord.video_url);
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      
      return new NextResponse(videoBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="flowtra-video-${historyId}.mp4"`,
          'Content-Length': videoBuffer.byteLength.toString(),
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
