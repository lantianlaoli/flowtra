import { getSupabaseAdmin } from '@/lib/supabase';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { WATERMARK_REMOVAL_COST } from '@/lib/constants';
import { createWatermarkRemovalTask, isValidSoraVideoUrl } from '@/lib/kie-watermark-removal';

export interface StartWatermarkRemovalRequest {
  userId: string;
  videoUrl: string;
}

interface WorkflowResult {
  success: boolean;
  projectId?: string;
  error?: string;
  details?: string;
}

/**
 * Start watermark removal workflow
 * 1. Validate video URL
 * 2. Check user credits (needs 3 credits)
 * 3. Deduct credits upfront
 * 4. Create database record
 * 5. Submit to KIE API
 * 6. Auto-refund on failure
 */
export async function startWatermarkRemovalWorkflow(
  request: StartWatermarkRemovalRequest
): Promise<WorkflowResult> {
  const supabase = getSupabaseAdmin();

  try {
    // Step 1: Validate video URL
    if (!isValidSoraVideoUrl(request.videoUrl)) {
      return {
        success: false,
        error: 'Invalid video URL',
        details: 'Please provide a valid Sora ChatGPT video URL (sora.chatgpt.com)',
      };
    }

    // Step 2: Check credits
    const creditCheck = await checkCredits(request.userId, WATERMARK_REMOVAL_COST);
    if (!creditCheck.success) {
      return {
        success: false,
        error: 'Failed to check credits',
        details: creditCheck.error || 'Credit check failed',
      };
    }

    if (!creditCheck.hasEnoughCredits) {
      return {
        success: false,
        error: 'Insufficient credits',
        details: `Need ${WATERMARK_REMOVAL_COST} credits for watermark removal, have ${
          creditCheck.currentCredits || 0
        }`,
      };
    }

    // Step 3: Deduct credits UPFRONT
    const deductResult = await deductCredits(request.userId, WATERMARK_REMOVAL_COST);
    if (!deductResult.success) {
      return {
        success: false,
        error: 'Failed to deduct credits',
        details: deductResult.error || 'Credit deduction failed',
      };
    }

    // Record the transaction
    await recordCreditTransaction(
      request.userId,
      'usage',
      WATERMARK_REMOVAL_COST,
      'Watermark Removal - Remove watermark',
      undefined,
      true
    );

    // Step 4: Create database record
    const { data: project, error: insertError } = await supabase
      .from('sora2_watermark_removal_tasks')
      .insert({
        user_id: request.userId,
        input_video_url: request.videoUrl,
        status: 'processing',
        credits_used: WATERMARK_REMOVAL_COST,
      })
      .select()
      .single();

    if (insertError || !project) {
      console.error('Database insert error:', insertError);

      // REFUND credits on database failure
      console.log(`⚠️ Refunding ${WATERMARK_REMOVAL_COST} credits due to database failure`);
      await deductCredits(request.userId, -WATERMARK_REMOVAL_COST); // Negative = refund
      await recordCreditTransaction(
        request.userId,
        'refund',
        WATERMARK_REMOVAL_COST,
        'Watermark Removal - Refund for database error',
        undefined,
        true
      );

      return {
        success: false,
        error: 'Failed to create project record',
        details: insertError?.message || 'Database error',
      };
    }

    // Step 5: Submit to KIE API
    try {
      const callbackUrl = process.env.KIE_WATERMARK_REMOVAL_CALLBACK_URL;

      const taskResponse = await createWatermarkRemovalTask({
        video_url: request.videoUrl,
        callBackUrl: callbackUrl,
      });

      // Update project with task ID
      await supabase
        .from('sora2_watermark_removal_tasks')
        .update({
          kie_task_id: taskResponse.data.taskId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      console.log('✅ Watermark removal task created successfully:', taskResponse.data.taskId);

      return {
        success: true,
        projectId: project.id,
      };
    } catch (apiError) {
      console.error('KIE API error:', apiError);

      // REFUND credits on API failure
      console.log(`⚠️ Refunding ${WATERMARK_REMOVAL_COST} credits due to API failure`);
      await deductCredits(request.userId, -WATERMARK_REMOVAL_COST); // Negative = refund
      await recordCreditTransaction(
        request.userId,
        'refund',
        WATERMARK_REMOVAL_COST,
        'Watermark Removal - Refund for failed removal',
        project.id,
        true
      );

      // Update project status to failed
      await supabase
        .from('sora2_watermark_removal_tasks')
        .update({
          status: 'failed',
          error_message: apiError instanceof Error ? apiError.message : 'API request failed',
        })
        .eq('id', project.id);

      return {
        success: false,
        error: 'Failed to submit watermark removal task',
        details: apiError instanceof Error ? apiError.message : 'Unknown error',
      };
    }
  } catch (error) {
    console.error('Watermark removal workflow error:', error);
    return {
      success: false,
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
