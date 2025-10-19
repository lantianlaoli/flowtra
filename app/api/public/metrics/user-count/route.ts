import { NextResponse } from 'next/server'
import { getActivatedUserCount } from '@/lib/publicMetrics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public metrics: real user count for landing page social proof
export async function GET() {
  try {
    const count = await getActivatedUserCount()
    return NextResponse.json({ success: true, count })
  } catch (err) {
    console.error('[user-count] Unexpected error:', err)
    const fallback = Number(process.env.NEXT_PUBLIC_FALLBACK_USER_COUNT ?? 0)
    return NextResponse.json({ success: true, count: fallback })
  }
}
