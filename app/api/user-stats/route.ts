import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 Fetching user stats for:', userId);

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
    } else {
      console.log('📈 Competitor UGC Replication records:', competitorUgcReplicationHistory?.length || 0);
    }

    // Query Character Ads projects
    type CharacterAdsRow = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: characterAdsHistory, error: errorCharacter } = await supabase
      .from('character_ads_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorCharacter) {
      console.error('❌ Error querying character_ads_projects:', errorCharacter);
    } else {
      console.log('📈 Character Ads records:', characterAdsHistory?.length || 0);
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

    // Calculate stats from Character Ads data
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

    console.log('✅ Calculated stats:', stats);

    // Query onboarding progress data
    const { data: brands, error: brandsError } = await supabase
      .from('user_brands')
      .select('id')
      .eq('user_id', userId);

    if (brandsError) {
      console.error('❌ Error querying user_brands:', brandsError);
    } else {
      console.log('✅ Brands query result:', { count: brands?.length, brands });
    }

    const { data: products, error: productsError } = await supabase
      .from('user_products')
      .select('id')
      .eq('user_id', userId);

    if (productsError) {
      console.error('❌ Error querying user_products:', productsError);
    } else {
      console.log('✅ Products query result:', { count: products?.length, products });
    }

    // Calculate onboarding progress
    const hasBrand = (brands?.length ?? 0) > 0;
    const hasProduct = (products?.length ?? 0) > 0;
    const hasCreatedAd = stats.totalVideos > 0;
    const tasksCompleted = [hasBrand, hasProduct, hasCreatedAd].filter(Boolean).length;

    const onboardingProgress = {
      hasBrand,
      hasProduct,
      hasCreatedAd,
      tasksCompleted,
      totalTasks: 3
    };

    console.log('✅ Onboarding progress:', onboardingProgress);

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
      hasBrand: false,
      hasProduct: false,
      hasCreatedAd: false,
      tasksCompleted: 0,
      totalTasks: 3
    };

    return NextResponse.json({
      success: true,
      stats: fallbackStats,
      onboardingProgress: fallbackProgress
    });
  }
}
