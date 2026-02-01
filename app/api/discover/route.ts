import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DiscoverType = 'all' | 'competitor-ugc-replication' | 'character' | 'motion-swap';

interface DiscoverItem {
  id: string;
  type: Exclude<DiscoverType, 'all'>;
  coverImageUrl: string;
  videoUrl?: string;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'all') as DiscoverType;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '48', 10) || 48, 12), 200);

    const supabase = getSupabaseAdmin();

    const items: DiscoverItem[] = [];

    // Competitor UGC Replication
    if (type === 'all' || type === 'competitor-ugc-replication') {
      // Schema verified via Supabase MCP (2026-02-01):
      // competitor_ugc_replication_projects has: video_url, merged_video_url,
      // merged_video_1080p_url, merged_video_4k_url, status, created_at
      const { data, error } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('id, video_url, merged_video_url, merged_video_1080p_url, merged_video_4k_url, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        for (const r of data) {
          const videoUrl =
            r.merged_video_4k_url ||
            r.merged_video_1080p_url ||
            r.merged_video_url ||
            r.video_url ||
            undefined;
          if (!videoUrl) continue;
          items.push({
            id: r.id,
            type: 'competitor-ugc-replication',
            coverImageUrl: videoUrl,
            videoUrl,
            createdAt: r.created_at,
          });
        }
      }
    }

    // Avatar Ads
    if (type === 'all' || type === 'character') {
      // Schema verified via Supabase MCP (2026-02-01):
      // avatar_ads_projects has: generated_image_url, merged_video_url,
      // generated_video_urls, status, created_at
      const { data, error } = await supabase
        .from('avatar_ads_projects')
        .select('id, generated_image_url, merged_video_url, generated_video_urls, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        for (const r of data) {
          const videoUrl: string | undefined = r.merged_video_url || (Array.isArray(r.generated_video_urls) ? r.generated_video_urls[0] : undefined) || undefined;
          if (!r.generated_image_url && !videoUrl) continue;
          items.push({
            id: r.id,
            type: 'character',
            coverImageUrl: r.generated_image_url || videoUrl,
            videoUrl,
            createdAt: r.created_at,
          });
        }
      }
    }

    // Motion Swap
    if (type === 'all' || type === 'motion-swap') {
      // Schema verified via Supabase MCP (2026-02-01):
      // motion_swap_projects has: preview_image_url, output_video_url, status, created_at
      const { data, error } = await supabase
        .from('motion_swap_projects')
        .select('id, preview_image_url, output_video_url, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        for (const r of data) {
          const videoUrl = r.output_video_url || undefined;
          const coverImageUrl = r.preview_image_url || videoUrl;
          if (!coverImageUrl) continue;
          items.push({
            id: r.id,
            type: 'motion-swap',
            coverImageUrl,
            videoUrl,
            createdAt: r.created_at,
          });
        }
      }
    }

    // Sort and slice to overall limit
    const sorted = items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const sliced = sorted.slice(0, limit);

    return NextResponse.json({ success: true, items: sliced });
  } catch (error) {
    console.error('Discover API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
