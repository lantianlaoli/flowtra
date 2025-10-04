import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 Fetching user stats for:', userId);

    const supabase = getSupabase();

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

    // Query Standard Ads projects
    type StandardAdsRow = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: standardAdsHistory, error: errorStandard } = await supabase
      .from('standard_ads_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorStandard) {
      console.error('❌ Error querying standard_ads_projects:', errorStandard);
    } else {
      console.log('📈 Standard Ads records:', standardAdsHistory?.length || 0);
    }

    // Query Multi-Variant Ads projects
    type MultiVariantAdsRow = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: multiVariantAdsHistory, error: errorMultiVariant } = await supabase
      .from('multi_variant_ads_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorMultiVariant) {
      console.error('❌ Error querying multi_variant_ads_projects:', errorMultiVariant);
    } else {
      console.log('📈 Multi-Variant Ads records:', multiVariantAdsHistory?.length || 0);
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

    // Calculate stats from Standard Ads data
    if (standardAdsHistory && standardAdsHistory.length > 0) {
      for (const record of standardAdsHistory as StandardAdsRow[]) {
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

    // Calculate stats from Multi-Variant Ads data
    if (multiVariantAdsHistory && multiVariantAdsHistory.length > 0) {
      for (const record of multiVariantAdsHistory as MultiVariantAdsRow[]) {
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

    if (standardAdsHistory) {
      for (const record of standardAdsHistory as StandardAdsRow[]) {
        totalCount++;
        if (record.status === 'completed') {
          completedCount++;
        }
      }
    }

    if (multiVariantAdsHistory) {
      for (const record of multiVariantAdsHistory as MultiVariantAdsRow[]) {
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

    return NextResponse.json({
      success: true,
      stats
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

    return NextResponse.json({
      success: true,
      stats: fallbackStats
    });
  }
}
