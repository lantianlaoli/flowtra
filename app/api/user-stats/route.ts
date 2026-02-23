import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS (we're already checking Clerk auth)
    const supabase = getSupabaseAdmin();

    // Get current month start and end dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Initialize stats with defaults
    const stats = {
      totalVideos: 0,
      thisMonth: 0,
      creditsUsed: 0,
      successRate: 0,
      hoursSaved: 0,
    };

    // Query Competitor UGC Replication projects
    type CompetitorUgcReplicationRow = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: competitorUgcReplicationHistory, error: errorStandard } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorStandard) {
      console.error('❌ Error querying competitor_ugc_replication_projects:', errorStandard);
    }

    // Query Avatar Ads projects
    type CharacterAdsRow = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: characterAdsHistory, error: errorCharacter } = await supabase
      .from('avatar_ads_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorCharacter) {
      console.error('❌ Error querying avatar_ads_projects:', errorCharacter);
    }

    // Calculate stats from Competitor UGC Replication data
    if (competitorUgcReplicationHistory && competitorUgcReplicationHistory.length > 0) {
      for (const record of competitorUgcReplicationHistory as CompetitorUgcReplicationRow[]) {
        stats.totalVideos++;

        // Check if this month
        const recordDate = new Date(record.created_at);
        if (recordDate >= currentMonthStart && recordDate <= currentMonthEnd) {
          stats.thisMonth++;
        }

        // Add credits used
        const creditsUsed = record.download_credits_used || 0;
        stats.creditsUsed += creditsUsed;
      }
    }

    // Calculate stats from Avatar Ads data
    if (characterAdsHistory && characterAdsHistory.length > 0) {
      for (const record of characterAdsHistory as CharacterAdsRow[]) {
        stats.totalVideos++;

        // Check if this month
        const recordDate = new Date(record.created_at);
        if (recordDate >= currentMonthStart && recordDate <= currentMonthEnd) {
          stats.thisMonth++;
        }

        // Add credits used (actual download charges)
        stats.creditsUsed += record.download_credits_used || 0;
      }
    }

    // Calculate success rate
    let completedCount = 0;
    let totalCount = 0;

    if (competitorUgcReplicationHistory) {
      for (const record of competitorUgcReplicationHistory as CompetitorUgcReplicationRow[]) {
        totalCount++;
        if (record.status === 'completed') {
          completedCount++;
        }
      }
    }

    if (characterAdsHistory) {
      for (const record of characterAdsHistory as CharacterAdsRow[]) {
        totalCount++;
        if (record.status === 'completed') {
          completedCount++;
        }
      }
    }

    // Calculate success rate percentage
    if (totalCount > 0) {
      stats.successRate = Math.round((completedCount / totalCount) * 100);
    }

    // Hours Saved = completed videos * baseline hours per video (2h)
    const HOURS_PER_VIDEO = 2;
    stats.hoursSaved = completedCount * HOURS_PER_VIDEO;

    // Query onboarding progress data
    const { data: tiktokVideos, error: tiktokVideosError } = await supabase
      .from('creator_source_videos')
      .select('id')
      .eq('user_id', userId);

    if (tiktokVideosError) {
      console.error('❌ Error querying creator_source_videos:', tiktokVideosError);
    }

    const { data: products, error: productsError } = await supabase
      .from('user_products')
      .select('id')
      .eq('user_id', userId);

    if (productsError) {
      console.error('❌ Error querying user_products:', productsError);
    }

    const { data: avatars, error: avatarsError } = await supabase
      .from('user_avatars')
      .select('id')
      .eq('user_id', userId);

    if (avatarsError) {
      console.error('❌ Error querying user_avatars:', avatarsError);
    }

    // Calculate onboarding progress
    // Schema verified via Supabase MCP (2026-02-22):
    // creator_source_videos.user_id, user_products.user_id, user_avatars.user_id
    const hasImportedTiktok = (tiktokVideos?.length ?? 0) > 0;
    const hasProduct = (products?.length ?? 0) > 0;
    const hasAvatar = (avatars?.length ?? 0) > 0;
    const hasCreatedVideo = stats.totalVideos > 0;
    const tasksCompleted = [hasImportedTiktok, hasProduct, hasAvatar, hasCreatedVideo].filter(Boolean).length;

    const onboardingProgress = {
      hasImportedTiktok,
      hasProduct,
      hasAvatar,
      hasCreatedVideo,
      tasksCompleted,
      totalTasks: 4
    };

    return NextResponse.json({
      success: true,
      stats,
      onboardingProgress
    });

  } catch (error) {
    console.error('❌ Error fetching user stats:', error);

    // Return zero stats in case of error instead of fake data
    const fallbackStats = {
      totalVideos: 0,
      thisMonth: 0,
      creditsUsed: 0,
      successRate: 0,
      hoursSaved: 0,
    };

    const fallbackProgress = {
      hasImportedTiktok: false,
      hasProduct: false,
      hasAvatar: false,
      hasCreatedVideo: false,
      tasksCompleted: 0,
      totalTasks: 4
    };

    return NextResponse.json({
      success: true,
      stats: fallbackStats,
      onboardingProgress: fallbackProgress
    });
  }
}
