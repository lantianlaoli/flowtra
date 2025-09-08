import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPackageByName } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packageName, userEmail } = await request.json()

    if (!packageName) {
      return NextResponse.json(
        { success: false, error: 'Package name is required' },
        { status: 400 }
      )
    }

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'User email is required' },
        { status: 400 }
      )
    }

    // Get package details
    const packageData = getPackageByName(packageName as 'lite' | 'basic' | 'pro')
    if (!packageData) {
      return NextResponse.json(
        { success: false, error: 'Invalid package name' },
        { status: 400 }
      )
    }

    // Check environment configuration
    const isDevMode = process.env.CREEM_ENVIRONMENT === 'development'
    
    // Get product ID based on environment and package
    let productId: string | undefined
    if (packageName === 'lite') {
      productId = isDevMode ? process.env.LITE_PACK_CREEM_DEV_ID : process.env.LITE_PACK_CREEM_PROD_ID
    } else if (packageName === 'basic') {
      // Basic plan product IDs
      productId = isDevMode 
        ? process.env.BASIC_PACK_CREEM_DEV_ID
        : process.env.BASIC_PACK_CREEM_PROD_ID
    } else if (packageName === 'pro') {
      productId = isDevMode ? process.env.PRO_PACK_CREEM_DEV_ID : process.env.PRO_PACK_CREEM_PROD_ID
    }
    
    if (!productId) {
      return NextResponse.json(
        { success: false, error: `Package does not have a ${isDevMode ? 'development' : 'production'} product ID configured` },
        { status: 400 }
      )
    }

    // Select API configuration based on environment
    const apiUrl = isDevMode ? process.env.CREEM_API_URL_DEV : process.env.CREEM_API_URL_PROD
    const apiKey = isDevMode ? process.env.CREEM_API_KEY_DEV : process.env.CREEM_API_KEY_PROD

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: `${isDevMode ? 'Development' : 'Production'} Creem API configuration is missing` },
        { status: 500 }
      )
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'User-Agent': 'FlowtraApp/1.0.0',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        customer: {
          email: userEmail
        },
        product_id: productId,
        metadata: {
          userId: userId,
          packageName: packageName,
          environment: isDevMode ? 'development' : 'production'
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Creem API error: ${response.status}`)
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      checkout_url: data.checkout_url,
      checkout_id: data.id
    })

  } catch (error) {
    console.error('Create checkout error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout' },
      { status: 500 }
    )
  }
}
