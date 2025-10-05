import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public metrics: real user count for landing page social proof
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    // Count distinct users who have initialized credits (proxy for real activated users)
    const { count, error } = await supabase
      .from('user_credits')
      .select('user_id', { count: 'exact', head: true })

    if (error) {
      console.error('[user-count] Supabase error:', error)
      const fallback = Number(process.env.NEXT_PUBLIC_FALLBACK_USER_COUNT ?? 0)
      return NextResponse.json({ success: true, count: fallback })
    }

    return NextResponse.json({ success: true, count: count ?? 0 })
  } catch (err) {
    console.error('[user-count] Unexpected error:', err)
    const fallback = Number(process.env.NEXT_PUBLIC_FALLBACK_USER_COUNT ?? 0)
    return NextResponse.json({ success: true, count: fallback })
  }
}
