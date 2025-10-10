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

    // Check if this is the first download
    // VEO3 prepaid: If generation_credits_used > 0, credits were already deducted at generation
    const isFirstDownload = !project.downloaded;
    const isPrepaid = (project.generation_credits_used || 0) > 0;

    if (isFirstDownload && !isPrepaid) {
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
      const storedVideoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2';
      const resolvedVideoModel = project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;
      const unitSecondsCost = resolvedVideoModel === 'sora2' ? 10 : 8;
      const baseCostPerUnit = getCreditCost(resolvedVideoModel);
      const downloadCost = Math.round((videoDurationSeconds || project.video_duration_seconds || 8) / unitSecondsCost * baseCostPerUnit);

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

      // Record credit transaction
      const modelDisplay = resolvedVideoModel === 'veo3'
        ? 'VEO3 High Quality'
        : resolvedVideoModel === 'sora2'
          ? 'Sora2 Premium'
          : 'VEO3 Fast';
      const durationDisplay = `${project.video_duration_seconds}s`;
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: -downloadCost,
          type: 'usage',
          description: `Video download - character ads (${modelDisplay}, ${durationDisplay})`
        });

      if (transactionError) {
        console.error('Failed to record transaction:', transactionError);
        // Don't fail the download, just log the error
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
    } else if (isFirstDownload && isPrepaid) {
      // VEO3 prepaid: Just mark as downloaded without deducting credits
      const { error: updateError } = await supabase
        .from('character_ads_projects')
        .update({
          downloaded: true,
          download_credits_used: 0 // No additional credits for download
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
