import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { getAnalysisShotCount } from '@/lib/video-analysis-schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all reference videos for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-03-01): reference_videos has no brand dependency after migration 20260301_restructure_storage_and_remove_brands.
    let query = supabase
      .from('reference_videos')
      .select('*')
      .eq('user_id', userId);

    const { data: referenceVideos, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reference videos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reference videos', details: error.message },
        { status: 500 }
      );
    }

    // NEW: Enrich response with shot_count from analysis_result
    const enrichedAds = (referenceVideos || []).map(ad => {
      const shotCount = getAnalysisShotCount((ad.analysis_result as Record<string, unknown> | null) || null);
      return {
        ...ad,
        shot_count: shotCount
      };
    });

    return NextResponse.json({ success: true, referenceVideos: enrichedAds });
  } catch (error) {
    console.error('GET /api/reference-videos error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - DEPRECATED: Use /api/reference-videos/create-with-analysis instead
// This endpoint is kept for backward compatibility but should not be used for new implementations
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: 'This endpoint is deprecated',
        details: 'Please use /api/reference-videos/create-with-analysis endpoint instead. This endpoint no longer supports file storage.',
        migration: 'The new architecture requires video-only uploads and immediate analysis without permanent file storage.'
      },
      { status: 410 } // 410 Gone - resource no longer available
    );
  } catch (error) {
    console.error('POST /api/reference-videos error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
