import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { createServerUserSupabaseClient } from '@/lib/supabase/server-user';

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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    // Support both JSON and FormData (form submit)
    const contentType = request.headers.get('content-type') || '';
    let historyId: string;
    let requestedUserId: string | null = null;
    let validateOnly: boolean | undefined;

    if (contentType.includes('application/json')) {
      // JSON format (validation request)
      const body: DownloadVideoRequest & { validateOnly?: boolean } = await request.json();
      historyId = body.historyId;
      requestedUserId = body.userId;
      validateOnly = body.validateOnly;
    } else {
      // FormData format (form submit download)
      const formData = await request.formData();
      historyId = formData.get('historyId') as string;
      requestedUserId = formData.get('userId') as string | null;
      validateOnly = formData.get('validateOnly') === 'true';
    }

    if (!historyId) {
      return NextResponse.json({
        success: false,
        message: 'History ID is required'
      }, { status: 400 });
    }

    if (requestedUserId && requestedUserId !== clerkUserId) {
      return NextResponse.json({
        success: false,
        message: 'Forbidden'
      }, { status: 403 });
    }

    const userId = clerkUserId;
    const supabase = await createServerUserSupabaseClient();

    // Schema verified via Supabase MCP (2026-01-23): motion_swap_projects columns include
    // id, user_id, status, output_video_url, downloaded, updated_at
    const { data: motionSwapRecord, error: motionSwapError } = await supabase
      .from('motion_swap_projects')
      .select('*')
      .eq('id', historyId)
      .eq('user_id', userId)
      .single();

    if (motionSwapRecord && !motionSwapError) {
      if (motionSwapRecord.status !== 'completed' || !motionSwapRecord.output_video_url) {
        return NextResponse.json({
          success: false,
          message: 'Video generation not completed yet'
        }, { status: 400 });
      }

      const isFirstDownload = !motionSwapRecord.downloaded;

      if (isFirstDownload) {
        if (validateOnly) {
          return NextResponse.json({
            success: true,
            message: 'Validation successful (download is free)',
            downloadCost: 0
          }, { status: 200 });
        }

        const { error: updateError } = await supabase
          .from('motion_swap_projects')
          .update({
            downloaded: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', historyId);

        if (updateError) {
          console.error('Failed to update motion swap record:', updateError);
          return NextResponse.json({
            success: false,
            message: 'Failed to update download record'
          }, { status: 500 });
        }
      } else if (validateOnly) {
        return NextResponse.json({
          success: true,
          message: 'Validation successful (already downloaded)',
          downloadCost: 0
        }, { status: 200 });
      }

      try {
        const videoResponse = await fetch(motionSwapRecord.output_video_url);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status}`);
        }

        return new NextResponse(videoResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename=\"flowtra-motion-swap-${historyId}.mp4\"`,
            'Content-Length': videoResponse.headers.get('content-length') || '',
            'x-flowtra-download-cost': '0',
          },
        });
      } catch (downloadError) {
        console.error('Failed to download motion swap video:', downloadError);
        return NextResponse.json({
          success: false,
          message: 'Failed to download video file'
        }, { status: 500 });
      }
    }

    // Schema verified via Supabase MCP (2026-03-06): competitor_ugc_replication_projects columns include
    // id, user_id, status, video_url, merged_video_url, downloaded, download_credits_used, last_processed_at
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

    const downloadableVideoUrl = historyRecord.video_url || historyRecord.merged_video_url;

    if (historyRecord.status !== 'completed' || !downloadableVideoUrl) {
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
      const videoResponse = await fetch(downloadableVideoUrl);
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
