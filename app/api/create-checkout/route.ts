import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPackageByName } from '@/lib/constants'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { captureServerEvent } from '@/lib/analytics/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🛒 Create checkout request received')

    const { userId } = await auth()

    if (!userId) {
      console.log('❌ Unauthorized request - no userId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { packageName, userEmail, isSubscription } = await request.json()
    console.log(`📦 Package: ${packageName}, Email: ${userEmail}, User: ${userId}, Subscription: ${isSubscription}`)
    captureServerEvent(ANALYTICS_EVENTS.checkout_started, {
      distinctId: userId,
      request,
      properties: {
        feature: 'billing',
        surface: 'create_checkout_api',
        package_name: packageName,
        billing_mode: isSubscription ? 'subscription' : 'one_time',
      }
    })

    if (!packageName) {
      console.log('❌ Package name is missing')
      return NextResponse.json(
        { success: false, error: 'Package name is required' },
        { status: 400 }
      )
    }

    if (!userEmail) {
      console.log('❌ User email is missing')
      return NextResponse.json(
        { success: false, error: 'User email is required' },
        { status: 400 }
      )
    }

    // Get package details
    const packageData = getPackageByName(packageName as 'lite' | 'plus' | 'basic' | 'pro')
    if (!packageData) {
      console.log(`❌ Invalid package name: ${packageName}`)
      return NextResponse.json(
        { success: false, error: 'Invalid package name' },
        { status: 400 }
      )
    }

    // Resolve Creem product ID for the requested tier
    console.log('💳 Creating SUBSCRIPTION checkout')
    let productId: string | undefined
    if (packageName === 'lite') {
      productId = process.env.LITE_PACK_CREEM_ID
    } else if (packageName === 'plus') {
      productId = process.env.PLUS_PACK_CREEM_ID
    } else if (packageName === 'basic') {
      productId = process.env.PRO_PACK_CREEM_ID
    } else if (packageName === 'pro') {
      productId = process.env.ULTRA_PACK_CREEM_ID
    }

    console.log(`🎯 Product ID for ${packageName} subscription: ${productId}`)

    if (!productId) {
      const error = `Package does not have a Creem product ID configured`
      console.log(`❌ ${error}`)
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      )
    }

    // Single Creem environment (no dev/prod switching)
    const apiUrl = process.env.CREEM_API_URL
    const apiKey = process.env.CREEM_API_KEY

    console.log(`🔗 API URL: ${apiUrl}`)
    console.log(`🔑 API Key present: ${apiKey ? 'YES' : 'NO'}`)

    if (!apiUrl || !apiKey) {
      const error = `Creem API configuration is missing`
      console.log(`❌ ${error}`)
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      )
    }

    // Determine success URL based on environment
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const successUrl = `${siteUrl}/dashboard`

    console.log(`🎯 Success URL: ${successUrl}`)

    const requestBody = {
      customer: {
        email: userEmail
      },
      product_id: productId,
      success_url: successUrl,
      metadata: {
        userId: userId,
        packageName: packageName,
      }
    }

    console.log('📡 Sending request to Creem API:', {
      url: apiUrl,
      body: requestBody
    })

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
      body: JSON.stringify(requestBody)
    })

    console.log(`📡 Creem API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.log(`❌ Creem API error response: ${errorText}`)
      throw new Error(`Creem API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ Creem API response data:', data)

    if (!data.checkout_url) {
      console.log('❌ No checkout_url in response')
      throw new Error('No checkout URL received from Creem API')
    }

    console.log(`🔗 Checkout URL: ${data.checkout_url}`)
    captureServerEvent(ANALYTICS_EVENTS.checkout_created, {
      distinctId: userId,
      request,
      properties: {
        feature: 'billing',
        surface: 'create_checkout_api',
        package_name: packageName,
        billing_mode: isSubscription ? 'subscription' : 'one_time',
        checkout_id: data.id
      }
    })

    return NextResponse.json({
      success: true,
      checkout_url: data.checkout_url,
      checkout_id: data.id
    })

  } catch (error) {
    console.error('❌ Create checkout error:', error)
    captureServerEvent(ANALYTICS_EVENTS.checkout_failed, {
      request,
      properties: {
        feature: 'billing',
        surface: 'create_checkout_api',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorDetails = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }

    console.error('🔍 Error details:', errorDetails)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create checkout',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
