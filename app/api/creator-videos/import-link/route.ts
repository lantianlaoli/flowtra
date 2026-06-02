import { after, NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchSocialVideoInfo, isValidSocialVideoUrl, detectPlatform } from '@/lib/fetch-social-video';
import { downloadVideoBuffer, uploadCreatorVideoToStorage } from '@/lib/creator-videos-storage';
import { analyzeCreatorVideoAndUpdate } from '@/lib/creator-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const extractVideoId = (url: string): string | null => {
  // TikTok: /video/<id>
  const tikTokMatch = url.match(/\/video\/(\d+)/i);
  if (tikTokMatch?.[1]) return tikTokMatch[1].trim();
  // Instagram: /p/<shortcode>/ or /reel/<shortcode>/
  const igMatch = url.match(/\/(p|reel|reels|tv)\/([\w-]+)/i);
  if (igMatch?.[2]) return igMatch[2].trim();
  // YouTube: v=<id> or youtu.be/<id>
  const ytMatch = url.match(/(?:v=|youtu\.be\/)([\w-]+)/i);
  if (ytMatch?.[1]) return ytMatch[1].trim();
  return null;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const providedAnalysisResult =
      body.analysisResult && typeof body.analysisResult === 'object'
        ? body.analysisResult as Record<string, unknown>
        : null;
    const providedLanguage = typeof body.language === 'string' ? body.language.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'Video link is required' }, { status: 400 });
    }
    if (!isValidSocialVideoUrl(url)) {
      return NextResponse.json(
        { error: 'Unsupported video link. Please provide a TikTok, Instagram, YouTube, or Facebook video URL.' },
        { status: 400 }
      );
    }

    const platform = detectPlatform(url) || 'tiktok';
    const videoId = extractVideoId(url);
    const sourceName = 'Imported';

    const supabase = getSupabaseAdmin();

    const { data: existingSources, error: sourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_name', sourceName);

    if (sourceError) {
      console.error('[Creator Videos Import Link] Source fetch error:', sourceError);
      return NextResponse.json({ error: 'Failed to load creator source' }, { status: 500 });
    }

    let source = existingSources?.[0] || null;

    if (!source) {
      const { data: createdSource, error: createError } = await supabase
        .from('creator_sources')
        .insert({ user_id: userId, source_name: sourceName })
        .select()
        .single();

      if (createError || !createdSource) {
        console.error('[Creator Videos Import Link] Source create error:', createError);
        return NextResponse.json({ error: 'Failed to create creator source' }, { status: 500 });
      }

      source = createdSource;
    }

    // Fetch video info (URL + thumbnail) in one API call
    let videoInfo: Awaited<ReturnType<typeof fetchSocialVideoInfo>> | null = null;
    try {
      videoInfo = await fetchSocialVideoInfo(url);
    } catch (error) {
      console.warn('[Creator Videos Import Link] Failed to fetch video info:', error);
    }

    if (!videoInfo?.videoUrl) {
      return NextResponse.json({ error: 'Failed to fetch video URL' }, { status: 500 });
    }

    const { videoUrl: cdnUrl, durationSeconds: apiDuration } = videoInfo;

    const platformVideoId = videoId || crypto.randomUUID();
    const analysisDurationSeconds =
      typeof providedAnalysisResult?.video_duration_seconds === 'number'
        ? providedAnalysisResult.video_duration_seconds
        : apiDuration;
    const analysisLanguage =
      providedLanguage
      || (typeof providedAnalysisResult?.detected_language === 'string'
        ? providedAnalysisResult.detected_language
        : null);

    const creatorVideoUpsertPayload: Record<string, unknown> = {
      user_id: userId,
      source_id: source.id,
      platform: 'tiktok',  // DB CHECK CONSTRAINT only allows 'tiktok' for now
      platform_video_id: platformVideoId,
      video_url: url,
      video_cdn_url: cdnUrl,
      analysis_error: null
    };

    if (providedAnalysisResult) {
      creatorVideoUpsertPayload.analysis_status = 'completed';
      creatorVideoUpsertPayload.analysis_result = providedAnalysisResult;
      creatorVideoUpsertPayload.analysis_language = analysisLanguage;
      creatorVideoUpsertPayload.analyzed_at = new Date().toISOString();
      creatorVideoUpsertPayload.duration_seconds = analysisDurationSeconds != null ? Math.round(analysisDurationSeconds) : analysisDurationSeconds;
    } else {
      creatorVideoUpsertPayload.analysis_status = 'pending';
      if (analysisDurationSeconds) {
        creatorVideoUpsertPayload.duration_seconds = Math.round(analysisDurationSeconds);
      }
    }

    const { data: storedVideo, error: videoError } = await supabase
      .from('creator_source_videos')
      .upsert(creatorVideoUpsertPayload, { onConflict: 'source_id,platform,platform_video_id' })
      .select()
      .single();

    if (videoError || !storedVideo) {
      console.error('[Creator Videos Import Link] Video insert error:', videoError);
      return NextResponse.json({ error: 'Failed to save video' }, { status: 500 });
    }

    const storedVideoId = storedVideo.id;
    const sourceNameForAnalysis = source.source_name;
    const originalCdnUrl = cdnUrl;
    const expectedVideoFileName = `${platformVideoId}.mp4`;

    // Run heavy tasks after response to avoid connection timeouts
    after(async () => {
      const bgSupabase = getSupabaseAdmin();
      let analysisVideoUrl = originalCdnUrl;

      // Upload video to Supabase Storage
      try {
        const { buffer, contentType } = await downloadVideoBuffer(originalCdnUrl);
        const uploadResult = await uploadCreatorVideoToStorage({
          userId,
          creatorVideoId: storedVideoId,
          fileName: expectedVideoFileName,
          buffer,
          contentType
        });

        analysisVideoUrl = uploadResult.publicUrl;

        await bgSupabase
          .from('creator_source_videos')
          .update({
            video_cdn_url: uploadResult.publicUrl,
            storage_bucket: uploadResult.bucket,
            storage_path: uploadResult.path
          })
          .eq('id', storedVideoId);
      } catch (storageError) {
        console.warn('[Creator Videos Import Link] Background storage upload failed, using CDN URL:', storageError);
      }

      // Run AI analysis if not already provided
      if (!providedAnalysisResult) {
        try {
          await analyzeCreatorVideoAndUpdate({
            supabase: bgSupabase,
            videoId: storedVideoId,
            videoUrl: analysisVideoUrl,
            sourceName: sourceNameForAnalysis,
            durationSeconds: storedVideo.duration_seconds
          });
        } catch (analysisError) {
          console.error('[Creator Videos Import Link] Background analysis failed:', analysisError);
        }
      }
    });

    return NextResponse.json({
      video: {
        ...storedVideo,
        source_name: source.source_name
      }
    });
  } catch (error) {
    console.error('[Creator Videos Import Link] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
