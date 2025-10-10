import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { getCreditCost } from '@/lib/constants';

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

    // Handle download logic - first time download charges credits, repeat downloads are free
    // VEO3 prepaid: If generation_credits_used > 0, credits were already deducted at generation
    const isFirstDownload = !historyRecord.downloaded;
    const isPrepaid = (historyRecord.generation_credits_used || 0) > 0;

    if (isFirstDownload && !isPrepaid) {
      // Charge full cost on first download (generation is free)
      const videoModelForCost = historyRecord.video_model as 'veo3' | 'veo3_fast' | 'sora2';
      const downloadCost = getCreditCost(videoModelForCost);

      // Check if user has enough credits
      const creditCheck = await checkCredits(userId, downloadCost);
      if (!creditCheck.success) {
        return NextResponse.json({
          success: false,
          message: creditCheck.error || 'Failed to check credits'
        }, { status: 500 });
      }

      if (!creditCheck.hasEnoughCredits) {
        return NextResponse.json({
          success: false,
          message: `Insufficient credits. Need ${downloadCost}, have ${creditCheck.currentCredits || 0}`
        }, { status: 400 });
      }

      // Deduct download credits
      const deductResult = await deductCredits(userId, downloadCost);
      if (!deductResult.success) {
        return NextResponse.json({
          success: false,
          message: deductResult.error || 'Failed to deduct credits'
        }, { status: 500 });
      }

      // Record the transaction
      await recordCreditTransaction(
        userId,
        'usage',
        downloadCost,
        `Video download - ${
          historyRecord.video_model === 'veo3'
            ? 'VEO3 High Quality'
            : historyRecord.video_model === 'sora2'
              ? 'Sora 2'
              : 'VEO3 Fast'
        }`,
        historyId,
        true
      );

      // Update the history record to mark as downloaded
      const { error: updateError } = await supabase
        .from('standard_ads_projects')
        .update({
          downloaded: true,
          download_credits_used: downloadCost,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', historyId);

      if (updateError) {
        console.error('Failed to update history record:', updateError);
        // Try to refund credits if update failed
        await deductCredits(userId, -downloadCost);
        await recordCreditTransaction(
          userId,
          'refund',
          downloadCost,
          'Refund for failed download update',
          historyId,
          true
        );

        return NextResponse.json({
          success: false,
          message: 'Failed to update download record'
        }, { status: 500 });
      }
    } else if (isFirstDownload && isPrepaid) {
      // VEO3 prepaid: Just mark as downloaded without deducting credits
      const { error: updateError } = await supabase
        .from('standard_ads_projects')
        .update({
          downloaded: true,
          download_credits_used: 0, // No additional credits for download
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
    // For repeat downloads, no credit deduction or database updates needed

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
