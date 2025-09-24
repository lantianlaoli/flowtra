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
      successRate: 0
    };

    // Query V1 history (single_video_projects table)
    type V1Row = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: historyV1, error: errorV1 } = await supabase
      .from('standard_ads_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorV1) {
      console.error('❌ Error querying standard_ads_projects:', errorV1);
    } else {
      console.log('📈 V1 History records:', historyV1?.length || 0);
    }

    // Query V2 history (multi_variant_projects table)
    type V2Row = { status: string; created_at: string; download_credits_used?: number | null };
    const { data: historyV2, error: errorV2 } = await supabase
      .from('multi_variant_ads_projects')
      .select('status, created_at, download_credits_used')
      .eq('user_id', userId);

    if (errorV2) {
      console.error('❌ Error querying multi_variant_ads_projects:', errorV2);
    } else {
      console.log('📈 V2 History records:', historyV2?.length || 0);
    }

    // Calculate stats from V1 data
    if (historyV1 && historyV1.length > 0) {
      for (const record of historyV1 as V1Row[]) {
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

    // Calculate stats from V2 data
    if (historyV2 && historyV2.length > 0) {
      for (const record of historyV2 as V2Row[]) {
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

    if (historyV1) {
      for (const record of historyV1 as V1Row[]) {
        totalCount++;
        if (record.status === 'completed') {
          completedCount++;
        }
      }
    }

    if (historyV2) {
      for (const record of historyV2 as V2Row[]) {
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
      successRate: 0
    };

    return NextResponse.json({
      success: true,
      stats: fallbackStats
    });
  }
}
