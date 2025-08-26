import { NextRequest, NextResponse } from 'next/server'
import { addCredits, recordCreditTransaction } from '@/lib/credits'
import { getCreditsFromProductId } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Webhook POST request received')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))
    
    const payload = await request.json()
    
    console.log('📄 Creem webhook payload received:', JSON.stringify(payload, null, 2))

    // Extract data from webhook payload
    const { object, eventType } = payload
    console.log(`Processing event: ${eventType}`)
    
    let userId, checkoutId, productId

    if (eventType === 'checkout.completed') {
      const { id: _checkoutId, metadata } = object
      userId = metadata?.userId
      checkoutId = _checkoutId
      // Extract product_id from the webhook payload structure
      productId = object.product?.id || object.order?.product
      
      console.log(`📦 Product ID: ${productId}`)
      console.log(`👤 User ID: ${userId}`)
      console.log(`🛒 Checkout ID: ${checkoutId}`)
    } else {
      console.log(`Unsupported event type: ${eventType}`)
      return NextResponse.json({ success: true, message: 'Event type not handled' })
    }

    if (!userId) {
      console.error('❌ No userId found in webhook metadata')
      console.error('Available metadata:', object.metadata)
      return NextResponse.json({ error: 'No userId in metadata' }, { status: 400 })
    }

    if (!productId) {
      console.error('❌ No productId found in webhook payload')
      console.error('Available object.product:', object.product)
      console.error('Available object.order:', object.order)
      return NextResponse.json({ error: 'No productId in webhook payload' }, { status: 400 })
    }

    try {
      if (eventType === 'checkout.completed') {
        // Get credits and package info from product_id
        const packageInfo = getCreditsFromProductId(productId)
        
        if (!packageInfo) {
          console.error(`❌ Unknown product ID: ${productId}`)
          return NextResponse.json({ error: 'Unknown product ID' }, { status: 400 })
        }

        console.log(`💳 Found package: ${packageInfo.packageName} with ${packageInfo.credits} credits`)

        // Add credits to user account
        const result = await addCredits(userId, packageInfo.credits, checkoutId)

        if (!result.success) {
          console.error('❌ Failed to add credits:', result.error)
          return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
        }

        // Record the purchase transaction (use admin client to bypass RLS)
        const transactionResult = await recordCreditTransaction(
          userId,
          'purchase',
          packageInfo.credits,
          `Purchase ${packageInfo.packageName} package`,
          undefined, // historyId
          true // useAdminClient
        )

        if (!transactionResult.success) {
          console.error('❌ Failed to record transaction:', transactionResult.error)
          // Don't fail the webhook if transaction recording fails, credits were already added
        }

        console.log(`✅ Successfully added ${packageInfo.credits} credits to user ${userId} (${packageInfo.packageName} package)`)
        console.log(`💰 New balance: ${result.newBalance}`)
        console.log(`📝 Transaction recorded: ${transactionResult.success ? 'Yes' : 'Failed'}`)
        
        return NextResponse.json({ 
          success: true, 
          message: `Credits added successfully`,
          creditsAdded: packageInfo.credits,
          newBalance: result.newBalance,
          packageName: packageInfo.packageName,
          productId: productId
        })
      }
      
      // If we reach here, event was recognized but conditions weren't met
      console.log(`⚠️ Event ${eventType} recognized but conditions not met`)
      return NextResponse.json({ success: true, message: `Event ${eventType} processed but no action taken` })
      
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at webhook endpoint')
  const url = new URL(request.url)
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()))
  
  return NextResponse.json({ 
    success: true, 
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}