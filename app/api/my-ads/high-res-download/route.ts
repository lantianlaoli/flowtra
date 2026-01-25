import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Resolution = '1080p' | '4k';
type AdType = 'competitor-ugc-replication' | 'character';

interface DownloadRequestBody {
  historyId?: string;
  resolution?: Resolution;
  adType?: AdType;
}

const isResolution = (value?: string): value is Resolution => value === '1080p' || value === '4k';
const isAdType = (value?: string): value is AdType => value === 'competitor-ugc-replication' || value === 'character';

const PROJECT_FIELDS = {
  '1080p': 'merged_video_1080p_url',
  '4k': 'merged_video_4k_url'
} as const;

const SEGMENT_FIELDS = {
  '1080p': 'video_1080p_url',
  '4k': 'video_4k_url'
} as const;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let historyId: string | undefined;
    let resolution: Resolution | undefined;
    let adType: AdType | undefined;

    if (contentType.includes('application/json')) {
      const body = await request.json() as DownloadRequestBody;
      historyId = body.historyId;
      resolution = body.resolution;
      adType = body.adType;
    } else {
      const formData = await request.formData();
      historyId = formData.get('historyId') as string | undefined;
      resolution = formData.get('resolution') as Resolution | undefined;
      adType = formData.get('adType') as AdType | undefined;
    }

    if (!historyId || !isResolution(resolution) || !isAdType(adType)) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const projectField = PROJECT_FIELDS[resolution];
    const segmentField = SEGMENT_FIELDS[resolution];

    if (adType === 'competitor-ugc-replication') {
      // Schema verified via Supabase MCP (2026-01-25): competitor_ugc_replication_projects columns include
      // id, user_id, status, merged_video_1080p_url, merged_video_4k_url.
      const { data: project, error: projectError } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('id, user_id, status, merged_video_1080p_url, merged_video_4k_url')
        .eq('id', historyId)
        .eq('user_id', userId)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const mergedUrl = (project as Record<string, string | null>)[projectField] || null;
      let downloadUrl = mergedUrl;

      if (!downloadUrl) {
        // Schema verified via Supabase MCP (2026-01-25): competitor_ugc_replication_segments columns include
        // id, project_id, segment_index, video_1080p_url, video_4k_url.
        const { data: segments } = await supabase
          .from('competitor_ugc_replication_segments')
          .select('id, segment_index, video_1080p_url, video_4k_url')
          .eq('project_id', historyId)
          .order('segment_index', { ascending: true });

        if (segments && segments.length === 1) {
          downloadUrl = (segments[0] as Record<string, string | null>)[segmentField] || null;
        }
      }

      if (!downloadUrl) {
        return NextResponse.json({ error: 'High-res video not ready yet' }, { status: 400 });
      }

      const videoResponse = await fetchWithRetry(downloadUrl, {}, 3, 30000);
      if (!videoResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch video file' }, { status: 500 });
      }

      return new NextResponse(videoResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="flowtra-video-${resolution}-${historyId}.mp4"`,
          'Content-Length': videoResponse.headers.get('content-length') || ''
        }
      });
    }

    // Avatar Ads
    // Schema verified via Supabase MCP (2026-01-25): avatar_ads_projects columns include
    // id, user_id, status, merged_video_1080p_url, merged_video_4k_url.
    const { data: project, error: projectError } = await supabase
      .from('avatar_ads_projects')
      .select('id, user_id, status, merged_video_1080p_url, merged_video_4k_url')
      .eq('id', historyId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let downloadUrl = (project as Record<string, string | null>)[projectField] || null;

    if (!downloadUrl) {
      // Schema verified via Supabase MCP (2026-01-25): avatar_ads_scenes columns include
      // id, project_id, scene_number, video_1080p_url, video_4k_url.
      const { data: scenes } = await supabase
        .from('avatar_ads_scenes')
        .select('id, scene_number, video_1080p_url, video_4k_url')
        .eq('project_id', historyId)
        .order('scene_number', { ascending: true });

      if (scenes && scenes.length === 1) {
        downloadUrl = (scenes[0] as Record<string, string | null>)[segmentField] || null;
      }
    }

    if (!downloadUrl) {
      return NextResponse.json({ error: 'High-res video not ready yet' }, { status: 400 });
    }

    const videoResponse = await fetchWithRetry(downloadUrl, {}, 3, 30000);
    if (!videoResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch video file' }, { status: 500 });
    }

    return new NextResponse(videoResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="flowtra-avatar-ads-${resolution}-${historyId}.mp4"`,
        'Content-Length': videoResponse.headers.get('content-length') || ''
      }
    });
  } catch (error) {
    console.error('[High Res Download] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
