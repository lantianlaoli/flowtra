import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase';

const parseFallbackCount = () => {
  const fallback = Number(process.env.NEXT_PUBLIC_FALLBACK_USER_COUNT ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
};

export const getActivatedUserCount = cache(async (): Promise<number> => {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('user_credits')
      .select('user_id', { count: 'exact', head: true });

    if (error) {
      console.error('[publicMetrics] Failed to fetch activated user count:', error);
      return parseFallbackCount();
    }

    return count ?? parseFallbackCount();
  } catch (err) {
    console.error('[publicMetrics] Unexpected error reading user count:', err);
    return parseFallbackCount();
  }
});
