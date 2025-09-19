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

    const formData = await request.formData();
    const identityImage = formData.get('identityImage') as File;
    const title = formData.get('title') as string;
    const prompt = formData.get('prompt') as string;

    if (!identityImage || !title || !prompt) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (creditsError || !userCredits || userCredits.credits_remaining < THUMBNAIL_CREDIT_COST) {
      return NextResponse.json({ message: 'Insufficient credits' }, { status: 400 });
    }

    // Upload identity image to Supabase storage
    const imageBuffer = await identityImage.arrayBuffer();
    const imageFile = new Uint8Array(imageBuffer);
    const fileName = `${userId}_${Date.now()}_${identityImage.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`identity/${fileName}`, imageFile, {
        contentType: identityImage.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`identity/${fileName}`);

    // Prepare KIE API request
    const kieRequestBody = {
      model: "bytedance/seedream-v4-edit",
      callBackUrl: process.env.KIE_YOUTUBE_THUMBNAIL_CALLBACK_URL,
      input: {
        prompt: `${prompt.replace('"${title}"', `"${title}"`)}`,
        image_urls: [publicUrl],
        image_size: "landscape_16_9",
        max_images: 1
      }
    };

    console.log('KIE API request:', JSON.stringify(kieRequestBody, null, 2));

    // Call KIE API
    const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      },
      body: JSON.stringify(kieRequestBody)
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('KIE API error:', errorText);
      return NextResponse.json({ message: 'Failed to start generation' }, { status: 500 });
    }

    const kieResult = await kieResponse.json();
    console.log('KIE API response:', kieResult);

    if (kieResult.code !== 200) {
      return NextResponse.json({ message: kieResult.message || 'Generation failed' }, { status: 500 });
    }

    const taskId = kieResult.data.taskId;

    // Create record in database
    const { error: insertError } = await supabase
      .from('thumbnail_history')
      .insert({
        user_id: userId,
        task_id: taskId,
        identity_image_url: publicUrl,
        title: title,
        status: 'processing',
        credits_cost: THUMBNAIL_CREDIT_COST
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json({ message: 'Failed to save record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      message: 'Thumbnail generation started'
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}