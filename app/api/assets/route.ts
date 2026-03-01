import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, UserProduct } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS (we're already checking Clerk auth)
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-03-01) and migration 20260301_restructure_storage_and_remove_brands:
    // user_products is product-first and no longer depends on brand tables.
    const { data: allProducts, error: productsError } = await supabase
      .from('user_products')
      .select(`
        *,
        user_product_photos(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    const products = (allProducts || []) as UserProduct[];

    // Fetch creator sources (TikTok, etc.)
    // Schema verified via Supabase MCP (2026-01-28): creator_sources, creator_source_platforms, creator_source_videos
    const { data: creatorSources, error: creatorSourcesError } = await supabase
      .from('creator_sources')
      .select('*, creator_source_platforms(*), creator_source_videos(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('created_at', { ascending: false, foreignTable: 'creator_source_videos' });

    if (creatorSourcesError) {
      console.error('Error fetching creator sources:', creatorSourcesError);
      return NextResponse.json(
        { error: 'Failed to fetch creator sources' },
        { status: 500 }
      );
    }

    const creatorSourceVideoCount = (creatorSources || []).reduce((total, source) => {
      return total + (source.creator_source_videos?.length || 0);
    }, 0);

    const videos = (creatorSources || []).flatMap((source: {
      id: string;
      source_name: string;
      creator_source_videos?: Array<Record<string, any>>;
    }) => (
      (source.creator_source_videos || []).map((video: Record<string, any>) => ({
        ...video,
        source_id: source.id,
        source_name: source.source_name,
        source_type: 'creator'
      }))
    ));

    // Schema verified via Supabase MCP (2026-01-28): competitor_ads has analysis_result, language, video_duration_seconds
    const { data: competitorAds, error: competitorAdsError } = await supabase
      .from('competitor_ads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (competitorAdsError) {
      console.error('Error fetching competitor ads:', competitorAdsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitor ads' },
        { status: 500 }
      );
    }

    const competitorVideos = (competitorAds || []).map(ad => ({
      id: ad.id,
      user_id: ad.user_id,
      source_id: ad.id,
      platform: 'tiktok',
      platform_video_id: ad.id,
      video_url: '',
      video_cdn_url: null,
      cover_url: null,
      description: ad.competitor_name,
      stats: null,
      duration_seconds: ad.video_duration_seconds,
      analysis_status: ad.analysis_status,
      analysis_result: ad.analysis_result,
      analysis_error: ad.analysis_error,
      analysis_language: ad.language,
      analyzed_at: ad.analyzed_at,
      created_at: ad.created_at,
      updated_at: ad.updated_at,
      source_name: 'Legacy',
      source_type: 'competitor_ad',
      competitor_ad_id: ad.id
    }));

    const response = {
      products,
      creatorSources: creatorSources || [],
      videos: [...competitorVideos, ...videos],
      stats: {
        totalProducts: (allProducts?.length || 0),
        totalCreatorSources: creatorSources?.length || 0,
        totalCreatorVideos: creatorSourceVideoCount + competitorVideos.length
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Error in /api/assets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
