import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCreditCost } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { historyId, videoDurationSeconds } = await request.json();

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
    // For 8-second videos, accept single generated video; for others, require merged video
    let videoUrl = project.merged_video_url;
    if (!videoUrl && project.video_duration_seconds === 8 && project.generated_video_urls?.length > 0) {
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

    // Check if this is the first download
    const isFirstDownload = !project.downloaded;

    if (isFirstDownload) {
      // Get user credits
      const { data: userCredits, error: creditsError } = await supabase
        .from('user_credits')
        .select('credits_remaining')
        .eq('user_id', userId)
        .single();

      if (creditsError || !userCredits) {
        return NextResponse.json({ error: 'Failed to get user credits' }, { status: 500 });
      }

      // Calculate download cost based on video duration and model
      const baseCostPer8s = getCreditCost(project.video_model as 'veo3' | 'veo3_fast');
      const downloadCost = Math.round((videoDurationSeconds || project.video_duration_seconds || 8) / 8 * baseCostPer8s * 0.6);

      // Check if user has enough credits
      if (userCredits.credits_remaining < downloadCost) {
        return NextResponse.json({
          error: 'Insufficient credits',
          required: downloadCost,
          available: userCredits.credits_remaining
        }, { status: 402 });
      }

      // Deduct credits
      const { error: deductError } = await supabase
        .from('user_credits')
        .update({ credits_remaining: userCredits.credits_remaining - downloadCost })
        .eq('user_id', userId);

      if (deductError) {
        return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
      }

      // Mark project as downloaded
      const { error: updateError } = await supabase
        .from('character_ads_projects')
        .update({
          downloaded: true,
          download_credits_used: downloadCost
        })
        .eq('id', historyId);

      if (updateError) {
        console.error('Failed to mark project as downloaded:', updateError);
        // Don't fail the download, just log the error
      }
    }

    // Download the video file
    // videoUrl is already determined above based on video duration and available videos

    try {
      const videoResponse = await fetchWithRetry(videoUrl, {}, 3, 30000); // 3 retries, 30s timeout

      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();

      return new NextResponse(videoBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="flowtra-character-ads-${historyId}.mp4"`,
          'Content-Length': videoBuffer.byteLength.toString(),
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