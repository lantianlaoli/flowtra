import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check environment configuration
    const isDevMode = process.env.CREEM_ENVIRONMENT === 'development'

    // Get all environment variables (without exposing sensitive values)
    const config = {
      environment: process.env.CREEM_ENVIRONMENT,
      isDevMode,
      apiUrls: {
        dev: process.env.CREEM_API_URL_DEV,
        prod: process.env.CREEM_API_URL_PROD,
        current: isDevMode ? process.env.CREEM_API_URL_DEV : process.env.CREEM_API_URL_PROD
      },
      apiKeys: {
        dev: process.env.CREEM_API_KEY_DEV ? 'CONFIGURED' : 'MISSING',
        prod: process.env.CREEM_API_KEY_PROD ? 'CONFIGURED' : 'MISSING',
        current: (isDevMode ? process.env.CREEM_API_KEY_DEV : process.env.CREEM_API_KEY_PROD) ? 'CONFIGURED' : 'MISSING'
      },
      productIds: {
        lite: {
          dev: process.env.LITE_PACK_CREEM_DEV_ID ? 'CONFIGURED' : 'MISSING',
          prod: process.env.LITE_PACK_CREEM_PROD_ID ? 'CONFIGURED' : 'MISSING',
          current: (isDevMode ? process.env.LITE_PACK_CREEM_DEV_ID : process.env.LITE_PACK_CREEM_PROD_ID) ? 'CONFIGURED' : 'MISSING'
        },
        basic: {
          dev: process.env.BASIC_PACK_CREEM_DEV_ID ? 'CONFIGURED' : 'MISSING',
          prod: process.env.BASIC_PACK_CREEM_PROD_ID ? 'CONFIGURED' : 'MISSING',
          current: (isDevMode ? process.env.BASIC_PACK_CREEM_DEV_ID : process.env.BASIC_PACK_CREEM_PROD_ID) ? 'CONFIGURED' : 'MISSING'
        },
        pro: {
          dev: process.env.PRO_PACK_CREEM_DEV_ID ? 'CONFIGURED' : 'MISSING',
          prod: process.env.PRO_PACK_CREEM_PROD_ID ? 'CONFIGURED' : 'MISSING',
          current: (isDevMode ? process.env.PRO_PACK_CREEM_DEV_ID : process.env.PRO_PACK_CREEM_PROD_ID) ? 'CONFIGURED' : 'MISSING'
        }
      }
    }

    // Check for missing configurations
    const issues = []

    if (!config.apiUrls.current) {
      issues.push(`Missing API URL for ${isDevMode ? 'development' : 'production'} environment`)
    }

    if (config.apiKeys.current === 'MISSING') {
      issues.push(`Missing API Key for ${isDevMode ? 'development' : 'production'} environment`)
    }

    Object.entries(config.productIds).forEach(([packageName, ids]) => {
      if (ids.current === 'MISSING') {
        issues.push(`Missing Product ID for ${packageName} package in ${isDevMode ? 'development' : 'production'} environment`)
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