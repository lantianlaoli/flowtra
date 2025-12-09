import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';

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
      .from('competitor_ugc_replication_projects')
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

    // ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
    // ALL models: Download is FREE (already paid at generation)
    const isFirstDownload = !historyRecord.downloaded;

    if (isFirstDownload) {
      // ✅ VALIDATE-ONLY MODE: Always successful (no credits needed)
      if (validateOnly) {
        return NextResponse.json({
          success: true,
          message: 'Validation successful (download is free)',
          downloadCost: 0
        }, { status: 200 });
      }

      // Mark as downloaded (no credit deduction)
      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          downloaded: true,
          download_credits_used: 0, // Always 0 in Version 2.0
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
          'x-flowtra-download-cost': '0',
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
