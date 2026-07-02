import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Single Creem environment (no dev/prod switching)
    const config = {
      apiUrl: {
        current: process.env.CREEM_API_URL ? 'CONFIGURED' : 'MISSING'
      },
      apiKey: {
        current: process.env.CREEM_API_KEY ? 'CONFIGURED' : 'MISSING'
      },
      productIds: {
        lite: {
          current: process.env.LITE_PACK_CREEM_ID ? 'CONFIGURED' : 'MISSING'
        },
        plus: {
          current: process.env.PLUS_PACK_CREEM_ID ? 'CONFIGURED' : 'MISSING'
        },
        pro: {
          current: process.env.PRO_PACK_CREEM_ID ? 'CONFIGURED' : 'MISSING'
        },
        ultra: {
          current: process.env.ULTRA_PACK_CREEM_ID ? 'CONFIGURED' : 'MISSING'
        }
      }
    }

    // Check for missing configurations
    const issues = []

    if (config.apiUrl.current === 'MISSING') {
      issues.push('Missing CREEM_API_URL')
    }

    if (config.apiKey.current === 'MISSING') {
      issues.push('Missing CREEM_API_KEY')
    }

    Object.entries(config.productIds).forEach(([packageName, ids]) => {
      if (ids.current === 'MISSING') {
        issues.push(`Missing Product ID for ${packageName} package`)
      }
    })

    return NextResponse.json({
      success: true,
      config,
      issues,
      isConfigValid: issues.length === 0
    })

  } catch (error) {
    console.error('Creem config check error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check configuration' },
      { status: 500 }
    )
  }
}