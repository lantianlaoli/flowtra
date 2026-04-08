import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DISCOVER_TEMP_MEDIA_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type DiscoverType = 'all' | 'video-clone' | 'character' | 'motion-clone';

interface DiscoverItem {
  id: string;
  type: Exclude<DiscoverType, 'all'>;
  coverImageUrl: string;
  videoUrl?: string;
  createdAt: string;
}

function getUrlHost(url?: string) {
  if (!url) return null;

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isFalMediaUrl(url?: string) {
  const host = getUrlHost(url);
  return Boolean(host && host.endsWith('fal.media'));
}

function isKieMediaUrl(url?: string) {
  const host = getUrlHost(url);
  return Boolean(host && host.endsWith('aiquickdraw.com'));
}

function isRecentEnough(createdAt: string, nowMs: number) {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return nowMs - createdAtMs <= DISCOVER_TEMP_MEDIA_TTL_MS;
}

function isDiscoverMediaValid(url: string | undefined, createdAt: string, nowMs: number) {
  if (!url) return false;
  if (isFalMediaUrl(url)) return true;
  if (isKieMediaUrl(url)) return isRecentEnough(createdAt, nowMs);
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'all') as DiscoverType;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '48', 10) || 48, 12), 200);
    const nowMs = Date.now();

    const supabase = getSupabaseAdmin();

    const items: DiscoverItem[] = [];

    // Video Clone
    if (type === 'all' || type === 'video-clone') {
      // Schema verified via Supabase MCP (2026-02-01):
      // video_clone_projects has: video_url, merged_video_url,
      // merged_video_1080p_url, merged_video_4k_url, status, created_at
      const { data, error } = await supabase
        .from('video_clone_projects')
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
          if (!isDiscoverMediaValid(videoUrl, r.created_at, nowMs)) continue;
          items.push({
            id: r.id,
            type: 'video-clone',
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
          const rawVideoUrl: string | undefined = r.merged_video_url || (Array.isArray(r.generated_video_urls) ? r.generated_video_urls[0] : undefined) || undefined;
          const validImageUrl = isDiscoverMediaValid(r.generated_image_url || undefined, r.created_at, nowMs)
            ? r.generated_image_url || undefined
            : undefined;
          const validVideoUrl = isDiscoverMediaValid(rawVideoUrl, r.created_at, nowMs)
            ? rawVideoUrl
            : undefined;
          const coverImageUrl = validImageUrl || validVideoUrl;

          if (!coverImageUrl) continue;
          items.push({
            id: r.id,
            type: 'character',
            coverImageUrl,
            videoUrl: validVideoUrl,
            createdAt: r.created_at,
          });
        }
      }
    }

    // Motion Clone
    if (type === 'all' || type === 'motion-clone') {
      // Schema verified via Supabase MCP (2026-02-01):
      // motion_clone_projects has: preview_image_url, output_video_url, status, created_at
      const { data, error } = await supabase
        .from('motion_clone_projects')
        .select('id, preview_image_url, output_video_url, status, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        for (const r of data) {
          const validImageUrl = isDiscoverMediaValid(r.preview_image_url || undefined, r.created_at, nowMs)
            ? r.preview_image_url || undefined
            : undefined;
          const validVideoUrl = isDiscoverMediaValid(r.output_video_url || undefined, r.created_at, nowMs)
            ? r.output_video_url || undefined
            : undefined;
          const coverImageUrl = validImageUrl || validVideoUrl;

          if (!coverImageUrl) continue;
          items.push({
            id: r.id,
            type: 'motion-clone',
            coverImageUrl,
            videoUrl: validVideoUrl,
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
