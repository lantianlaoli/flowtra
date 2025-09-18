import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public metrics: user count for landing page social proof
// In development or when upstream is unavailable, fall back to a safe default.
export async function GET() {
  try {
    // Optional: allow override via env for demos
    const fallback = Number(process.env.NEXT_PUBLIC_FALLBACK_USER_COUNT ?? 19)

    // If you later want to fetch real metrics, add try/catch here.
    // For now, always return fallback quickly to avoid blocking UI.
    return NextResponse.json({ success: true, count: fallback })
  } catch (error) {
    return NextResponse.json({ success: true, count: 19 })
  }
}

