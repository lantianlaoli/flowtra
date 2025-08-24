import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { checkCredits, deductCredits } from '@/lib/credits';
import { getCreditCost } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoPrompt, coverImageUrl, model, historyId } = await request.json();
    
    // Use environment variable for model, fallback to request param, then default
    const selectedModel = model || process.env.VEO_MODEL || 'veo3_fast';

    if (!videoPrompt) {
      return NextResponse.json({ 
        error: 'Video prompt is required' 
      }, { status: 400 });
    }

    // Calculate required credits based on model
    const requiredCredits = getCreditCost(selectedModel as 'veo3' | 'veo3_fast');
    
    // Check if user has enough credits
    const creditCheck = await checkCredits(userId, requiredCredits);
    
    if (!creditCheck.success) {
      return NextResponse.json({
        error: creditCheck.error || 'Failed to check credits'
      }, { status: 500 });
    }

    if (!creditCheck.hasEnoughCredits) {
      return NextResponse.json({
        error: 'Insufficient credits',
        requiredCredits,
        currentCredits: creditCheck.currentCredits || 0,
        shortfall: requiredCredits - (creditCheck.currentCredits || 0)
      }, { status: 402 }); // 402 Payment Required
    }

    // Construct the full video prompt from the structured data
    const fullPrompt = `${videoPrompt.description} 

Setting: ${videoPrompt.setting}
Camera: ${videoPrompt.camera_type} with ${videoPrompt.camera_movement}
Action: ${videoPrompt.action}
Lighting: ${videoPrompt.lighting}
Dialogue: ${videoPrompt.dialogue}
Music: ${videoPrompt.music}
Ending: ${videoPrompt.ending}
Other details: ${videoPrompt.other_details}`;

    const requestBody: {
      prompt: string;
      model: string;
      aspectRatio: string;
      imageUrls?: string[];
    } = {
      prompt: fullPrompt,
      model: selectedModel,
      aspectRatio: "16:9"
    };

    // Add cover image if provided
    if (coverImageUrl) {
      requestBody.imageUrls = [coverImageUrl];
    }

    // Deduct credits before making the API call
    const deductResult = await deductCredits(userId, requiredCredits);
    
    if (!deductResult.success) {
      return NextResponse.json({
        error: deductResult.error || 'Failed to deduct credits'
      }, { status: 500 });
    }

    let historyRecordId = historyId;
    
    // Create or update history record
    try {
      if (historyId) {
        // Update existing history record
        const { error: updateError } = await supabase
          .from('user_history')
          .update({
            video_model: selectedModel,
            credits_used: requiredCredits,
            status: 'processing'
          })
          .eq('id', historyId)
          .eq('user_id', userId);

        if (updateError) {
          console.error('Failed to update history record:', updateError);
        }
      } else {
        // Create new history record
        const { data: historyData, error: insertError } = await supabase
          .from('user_history')
          .insert({
            user_id: userId,
            original_image_url: coverImageUrl || '',
            cover_image_url: coverImageUrl,
            product_description: videoPrompt.description || '',
            creative_prompts: videoPrompt,
            video_model: selectedModel,
            credits_used: requiredCredits,
            status: 'processing'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create history record:', insertError);
        } else {
          historyRecordId = historyData?.id;
        }
      }
    } catch (historyError) {
      console.error('History record error:', historyError);
      // Continue with video generation even if history fails
    }

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/veo/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }, 8, 30000); // 8 retries, 30 second timeout

    if (!response.ok) {
      // Refund credits if API call failed
      await deductCredits(userId, -requiredCredits); // Add credits back
      
      // Update history status to failed
      if (historyRecordId) {
        await supabase
          .from('user_history')
          .update({ 
            status: 'failed',
            error_message: 'Failed to generate video - API error'
          })
          .eq('id', historyRecordId);
      }

      const errorData = await response.text();
      return NextResponse.json(
        { error: 'Failed to generate video', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Handle new API response format
    if (data.code !== 200) {
      // Refund credits if API returned error
      await deductCredits(userId, -requiredCredits); // Add credits back
      
      // Update history status to failed
      if (historyRecordId) {
        await supabase
          .from('user_history')
          .update({ 
            status: 'failed',
            error_message: data.msg || 'Failed to generate video'
          })
          .eq('id', historyRecordId);
      }

      return NextResponse.json(
        { error: data.msg || 'Failed to generate video' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      taskId: data.data.taskId,
      creditsUsed: requiredCredits,
      remainingCredits: deductResult.remainingCredits,
      historyId: historyRecordId
    });
  } catch (error) {
    console.error('Video generation error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const historyId = searchParams.get('historyId');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const response = await fetchWithRetry(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      },
    }, 5, 15000); // 5 retries, 15 second timeout

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: 'Failed to get video details', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      return NextResponse.json(
        { error: data.msg || 'Failed to get video details' },
        { status: 400 }
      );
    }

    const taskData = data.data;
    let status = 'GENERATING';
    let videoUrl = null;

    // Map status based on successFlag: 0=Generating, 1=Success, 2=Failed, 3=Generation Failed
    if (taskData.successFlag === 1) {
      status = 'SUCCESS';
      videoUrl = taskData.response?.resultUrls?.[0] || null;
      
      // Update history record with video URL if available
      if (historyId && videoUrl) {
        try {
          await supabase
            .from('user_history')
            .update({ 
              status: 'completed',
              video_url: videoUrl
            })
            .eq('id', historyId)
            .eq('user_id', userId);
        } catch (updateError) {
          console.error('Failed to update history with video URL:', updateError);
        }
      }
    } else if (taskData.successFlag === 2 || taskData.successFlag === 3) {
      status = 'FAILED';
      
      // Update history record status to failed
      if (historyId) {
        try {
          await supabase
            .from('user_history')
            .update({ 
              status: 'failed',
              error_message: taskData.errorMessage || 'Video generation failed'
            })
            .eq('id', historyId)
            .eq('user_id', userId);
        } catch (updateError) {
          console.error('Failed to update history with failure:', updateError);
        }
      }
    } else {
      status = 'GENERATING';
    }
    
    return NextResponse.json({
      success: true,
      status,
      videoUrl,
      errorMessage: taskData.errorMessage || null
    });
  } catch (error) {
    console.error('Get video error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}