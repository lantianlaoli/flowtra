import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserSubscription } from '@/lib/subscription'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { captureServerEvent } from '@/lib/analytics/server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription to retrieve customer ID
    const subscriptionResult = await getUserSubscription(userId)

    if (!subscriptionResult.success || !subscriptionResult.subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    const subscription = subscriptionResult.subscription

    if (!subscription.creem_customer_id) {
      return NextResponse.json(
        { error: 'Customer ID not found' },
        { status: 400 }
      )
    }

    // Determine environment
    const isDevMode = process.env.CREEM_ENVIRONMENT === 'development'
    const creemApiUrl = isDevMode
      ? process.env.CREEM_API_URL_DEV
      : process.env.CREEM_API_URL_PROD
    const creemApiKey = isDevMode
      ? process.env.CREEM_API_KEY_DEV
      : process.env.CREEM_API_KEY_PROD

    if (!creemApiUrl || !creemApiKey) {
      console.error('Creem API configuration missing')
      return NextResponse.json(
        { error: 'Creem API configuration error' },
        { status: 500 }
      )
    }

    // Construct customer portal API URL
    // Extract base URL from checkout URL (e.g., https://api.creem.io/v1/checkouts -> https://api.creem.io)
    let portalApiUrl: string
    try {
      const url = new URL(creemApiUrl)
      // Reconstruct with correct customer billing endpoint
      portalApiUrl = `${url.origin}/v1/customers/billing`
    } catch (error) {
      console.error('❌ Failed to parse Creem API URL:', error)
      return NextResponse.json(
        { error: 'Invalid Creem API configuration' },
        { status: 500 }
      )
    }

    console.log(`📨 Creating customer portal link for customer: ${subscription.creem_customer_id}`)
    console.log('🔍 Debug Info:', {
      environment: isDevMode ? 'development' : 'production',
      baseApiUrl: creemApiUrl,
      portalApiUrl,
      customerId: subscription.creem_customer_id,
      customerIdPrefix: subscription.creem_customer_id?.substring(0, 5),
      apiKeyPrefix: creemApiKey?.substring(0, 10) + '...',
      subscriptionTier: subscription.tier,
      subscriptionStatus: subscription.status,
      subscriptionId: subscription.creem_subscription_id
    })

    // Validate environment consistency
    // Dev customer IDs typically start with 'cust_test_' or similar
    // Prod customer IDs typically start with 'cust_'
    if (subscription.creem_customer_id?.includes('test') && !isDevMode) {
      console.warn('⚠️ Warning: Test customer ID detected in production mode')
    }
    if (!subscription.creem_customer_id?.includes('test') && isDevMode) {
      console.warn('⚠️ Warning: Production customer ID detected in development mode')
    }

    const requestBody = {
      customer_id: subscription.creem_customer_id
    }

    console.log('📤 Request:', {
      url: portalApiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creemApiKey?.substring(0, 10) + '...'
      },
      body: requestBody
    })

    // Call Creem API to create customer portal link
    const response = await fetch(portalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creemApiKey
      },
      body: JSON.stringify(requestBody)
    })

    console.log('📥 Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Creem API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestUrl: portalApiUrl,
        customerId: subscription.creem_customer_id,
        environment: isDevMode ? 'development' : 'production',
        apiKeyPrefix: creemApiKey?.substring(0, 10) + '...'
      })

      // Try to parse error as JSON for better error message
      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.message || errorJson.error || errorText
      } catch {
        // errorText is not JSON, use as-is
      }

      return NextResponse.json(
        {
          error: 'Failed to create customer portal link',
          details: errorDetails,
          status: response.status
        },
        { status: response.status === 404 ? 404 : 500 }
      )
    }

    const data = await response.json()

    // API returns 'customer_portal_link' field
    if (!data.customer_portal_link) {
      console.error('❌ No customer_portal_link in response:', data)
      return NextResponse.json(
        { error: 'No portal URL in response' },
        { status: 500 }
      )
    }

    const portalUrl = data.customer_portal_link

    console.log(`✅ Customer portal created: ${portalUrl}`)
    captureServerEvent(ANALYTICS_EVENTS.subscription_portal_opened, {
      distinctId: userId,
      request,
      properties: {
        feature: 'billing',
        surface: 'subscription_portal_api',
        status: subscription.status
      }
    })

    return NextResponse.json({
      success: true,
      portal_url: portalUrl
    })
  } catch (error) {
    console.error('Create customer portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create customer portal link' },
      { status: 500 }
    )
  }
}
