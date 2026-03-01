import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all competitor ads for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-03-01): competitor_ads has no brand dependency after migration 20260301_restructure_storage_and_remove_brands.
    let query = supabase
      .from('competitor_ads')
      .select('*')
      .eq('user_id', userId);

    const { data: competitorAds, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitor ads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch competitor ads', details: error.message },
        { status: 500 }
      );
    }

    // NEW: Enrich response with shot_count from analysis_result
    const enrichedAds = (competitorAds || []).map(ad => {
      let shotCount = 0;
      if (ad.analysis_result && typeof ad.analysis_result === 'object') {
        const analysis = ad.analysis_result as Record<string, unknown>;
        if (Array.isArray(analysis.shots)) {
          shotCount = analysis.shots.length;
        }
      }
      return {
        ...ad,
        shot_count: shotCount
      };
    });

    return NextResponse.json({ success: true, competitorAds: enrichedAds });
  } catch (error) {
    console.error('GET /api/competitor-ads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - DEPRECATED: Use /api/competitor-ads/create-with-analysis instead
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
        details: 'Please use /api/competitor-ads/create-with-analysis endpoint instead. This endpoint no longer supports file storage.',
        migration: 'The new architecture requires video-only uploads and immediate analysis without permanent file storage.'
      },
      { status: 410 } // 410 Gone - resource no longer available
    );
  } catch (error) {
    console.error('POST /api/competitor-ads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
