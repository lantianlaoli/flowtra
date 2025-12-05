import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';
import { deriveSegmentDetails, type SegmentPrompt } from '@/lib/standard-ads-workflow';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Fetch latest completed video from V1 workflow (single_video_projects)
    const { data: historyV1, error: errorV1 } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (errorV1) {
      console.error('Failed to fetch recent videos:', { errorV1 });
      return NextResponse.json({
        error: 'Failed to fetch recent videos'
      }, { status: 500 });
    }

    // Combine and find the most recent video
    const allVideos = [];

    // Transform V1 data
    if (historyV1 && historyV1.length > 0) {
      const item = historyV1[0];
      let creativePrompt = null;
      if (item.video_prompts) {
        try {
          const parsed = typeof item.video_prompts === 'string'
            ? JSON.parse(item.video_prompts)
            : item.video_prompts;

          if (parsed && Array.isArray((parsed as { segments?: SegmentPrompt[] }).segments)) {
            const firstSegment = (parsed as { segments?: SegmentPrompt[] }).segments?.[0];
            if (firstSegment) {
              const derived = deriveSegmentDetails(firstSegment as SegmentPrompt);
              creativePrompt = {
                music: derived.music || null,
                action: derived.action || null,
                ending: derived.ending || null,
                setting: derived.setting || null
              };
            }
          } else {
            creativePrompt = {
              music: parsed?.music || null,
              action: parsed?.action || null,
              ending: parsed?.ending || null,
              setting: parsed?.setting || null
            };
          }
        } catch (e) {
          console.error('Failed to parse V1 creative prompts:', e);
        }
      }

      allVideos.push({
        id: item.id,
        thumbnail: item.cover_image_url || undefined,
        videoUrl: item.video_url || undefined,
        createdAt: item.created_at,
        status: 'completed' as const,
        generationTime: item.generation_time_minutes || undefined,
        modelUsed: item.video_model === 'veo3' ? 'VEO3 High Quality' : 'VEO3 Fast',
        creditsConsumed: item.download_credits_used || undefined,
        creativePrompt,
        workflowVersion: 'v1'
      });
    }

    // Sort by creation date and get the most recent
    allVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latestVideo = allVideos.length > 0 ? [allVideos[0]] : [];

    return NextResponse.json({
      success: true,
      videos: latestVideo
    });

  } catch (error) {
    console.error('Error fetching recent videos:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch recent videos'
    }, { status: 500 });
  }
}
