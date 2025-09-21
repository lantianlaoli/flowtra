import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';
import { THUMBNAIL_CREDIT_COST } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { identityImageUrl, title, prompt, imageCount = 1 } = await request.json();

    if (!identityImageUrl || !title || !prompt) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Validate imageCount
    if (imageCount < 1 || imageCount > 3) {
      return NextResponse.json({ message: 'Image count must be between 1 and 3' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check user credits (cost increases with image count) - but don't deduct yet
    const totalCreditsCost = THUMBNAIL_CREDIT_COST * imageCount;
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (creditsError || !userCredits || userCredits.credits_remaining < totalCreditsCost) {
      return NextResponse.json({
        message: `Insufficient credits! Generating ${imageCount} thumbnail${imageCount > 1 ? 's' : ''} requires ${totalCreditsCost} credits`
      }, { status: 400 });
    }

    // Prepare KIE API request
    const enhancedPrompt = imageCount > 1
      ? `Generate ${imageCount} different variations. ${prompt.replace('"${title}"', `"${title}"`)}`
      : `${prompt.replace('"${title}"', `"${title}"`)}`;

    const kieRequestBody = {
      model: "bytedance/seedream-v4-edit",
      callBackUrl: process.env.KIE_YOUTUBE_THUMBNAIL_CALLBACK_URL,
      input: {
        prompt: enhancedPrompt,
        image_urls: [identityImageUrl],
        image_size: "landscape_16_9",
        max_images: imageCount
      }
    };

    console.log('KIE API request:', JSON.stringify(kieRequestBody, null, 2));

    // Call KIE API with retry mechanism
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let kieResult;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`KIE API attempt ${attempt}/${maxRetries}`);

        const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
          },
          body: JSON.stringify(kieRequestBody),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!kieResponse.ok) {
          const errorText = await kieResponse.text();
          console.error(`KIE API error (attempt ${attempt}):`, errorText);

          if (attempt === maxRetries) {
            return NextResponse.json({
              message: `Failed to start generation after ${maxRetries} attempts`
            }, { status: 500 });
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        kieResult = await kieResponse.json();
        console.log('KIE API response:', kieResult);
        break; // Success, exit retry loop

      } catch (error) {
        console.error(`KIE API request failed (attempt ${attempt}):`, error);

        if (attempt === maxRetries) {
          return NextResponse.json({
            message: `Failed to connect to generation service after ${maxRetries} attempts. Please try again later.`
          }, { status: 500 });
        }

        // Wait before retrying, with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    if (kieResult.code !== 200) {
      return NextResponse.json({ message: kieResult.message || 'Generation failed' }, { status: 500 });
    }

    const taskId = kieResult.data.taskId;

    // Create record in database - no credits deducted at generation time
    const { error: insertError } = await supabase
      .from('thumbnail_history')
      .insert({
        user_id: userId,
        task_id: taskId,
        identity_image_url: identityImageUrl,
        title: title,
        status: 'processing',
        credits_cost: THUMBNAIL_CREDIT_COST, // Store cost for later use during download
        downloaded: false // Not downloaded yet
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json({ message: 'Failed to save record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      imageCount: imageCount,
      totalCreditsCost: totalCreditsCost,
      message: `Thumbnail generation started (${imageCount} image${imageCount > 1 ? 's' : ''})`
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}