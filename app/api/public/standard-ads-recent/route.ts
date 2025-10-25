import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';

interface StandardAdProjectRow {
  id: string;
  created_at: string;
  cover_image_url: string | null;
  video_url: string | null;
  product_description: Record<string, unknown> | string | null;
  video_model: string | null;
  status: string | null;
  video_duration: string | null;
  video_quality: 'standard' | 'high' | null;
}

interface StandardAdProject {
  id: string;
  createdAt: string;
  coverImageUrl?: string;
  videoUrl?: string;
  description?: string;
  videoModel?: string;
  status?: string;
  videoDuration?: string;
  videoQuality?: 'standard' | 'high';
}

function parseDescription(description: StandardAdProjectRow['product_description']): string | undefined {
  if (!description) {
    return undefined;
  }

  if (typeof description === 'string') {
    try {
      const parsed = JSON.parse(description) as { description?: string };
      return parsed.description ?? description;
    } catch {
      return description;
    }
  }

  const maybeRecord = description as { description?: unknown };
  const text = typeof maybeRecord.description === 'string' ? maybeRecord.description : undefined;
  return text;
}

function mapProjectRow(row: StandardAdProjectRow): StandardAdProject {
  return {
    id: row.id,
    createdAt: row.created_at,
    coverImageUrl: row.cover_image_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    description: parseDescription(row.product_description),
    videoModel: row.video_model ?? undefined,
    status: row.status ?? undefined,
    videoDuration: row.video_duration ?? undefined,
    videoQuality: row.video_quality ?? undefined
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = parseInt(url.searchParams.get('limit') ?? '3', 10);
    const limit = Number.isNaN(limitParam) ? 3 : Math.min(Math.max(limitParam, 1), 10);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('standard_ads_projects')
      .select(
        'id, created_at, cover_image_url, video_url, product_description, video_model, status, video_duration, video_quality'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch recent standard ads:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch recent standard ads' }, { status: 500 });
    }

    const projects = (data ?? []).map(mapProjectRow);

    return NextResponse.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('Unexpected error fetching public standard ads:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
