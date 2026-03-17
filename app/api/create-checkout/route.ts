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
    const packageData = getPackageByName(packageName as 'lite' | 'basic' | 'pro')
    if (!packageData) {
      console.log(`❌ Invalid package name: ${packageName}`)
      return NextResponse.json(
        { success: false, error: 'Invalid package name' },
        { status: 400 }
      )
    }

    // Check environment configuration
    const isDevMode = process.env.CREEM_ENVIRONMENT === 'development'
    console.log(`🌍 Environment: ${isDevMode ? 'DEVELOPMENT' : 'PRODUCTION'}`)
    console.log(`📋 CREEM_ENVIRONMENT value: ${process.env.CREEM_ENVIRONMENT}`)

    // Get subscription product ID based on environment and package
    // Note: Using PACK env vars as they contain subscription product IDs
    let productId: string | undefined

    console.log('💳 Creating SUBSCRIPTION checkout')
    if (packageName === 'lite') {
      productId = isDevMode ? process.env.LITE_PACK_CREEM_DEV_ID : process.env.LITE_PACK_CREEM_PROD_ID
    } else if (packageName === 'basic') {
      productId = isDevMode ? process.env.BASIC_PACK_CREEM_DEV_ID : process.env.BASIC_PACK_CREEM_PROD_ID
    } else if (packageName === 'pro') {
      productId = isDevMode ? process.env.PRO_PACK_CREEM_DEV_ID : process.env.PRO_PACK_CREEM_PROD_ID
    }

    console.log(`🎯 Product ID for ${packageName} subscription: ${productId}`)

    if (!productId) {
      const error = `Package does not have a ${isDevMode ? 'development' : 'production'} subscription product ID configured`
      console.log(`❌ ${error}`)
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      )
    }

    // Select API configuration based on environment
    const apiUrl = isDevMode ? process.env.CREEM_API_URL_DEV : process.env.CREEM_API_URL_PROD
    const apiKey = isDevMode ? process.env.CREEM_API_KEY_DEV : process.env.CREEM_API_KEY_PROD

    console.log(`🔗 API URL: ${apiUrl}`)
    console.log(`🔑 API Key present: ${apiKey ? 'YES' : 'NO'}`)

    if (!apiUrl || !apiKey) {
      const error = `${isDevMode ? 'Development' : 'Production'} Creem API configuration is missing`
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
        environment: isDevMode ? 'development' : 'production'
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
