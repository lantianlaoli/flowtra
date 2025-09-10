import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { getCreditCost, CREDIT_COSTS } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const resolvedParams = await params;
    const instanceId = resolvedParams.instanceId;
    const { contentType } = await request.json(); // 'cover' or 'video'
    
    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    if (!contentType || !['cover', 'video'].includes(contentType)) {
      return NextResponse.json({ error: 'Content type must be "cover" or "video"' }, { status: 400 });
    }

    console.log(`📥 Download request for instance ${instanceId}, type: ${contentType}`);

    const supabase = getSupabase();
    
    // Get workflow instance
    const { data: instance, error } = await supabase
      .from('user_history_v2')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (error || !instance) {
      return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
    }

    // Check if content is ready
    if (contentType === 'cover' && !instance.cover_image_url) {
      return NextResponse.json({ error: 'Cover image is not ready yet' }, { status: 400 });
    }
    
    if (contentType === 'video' && !instance.video_url) {
      return NextResponse.json({ error: 'Video is not ready yet' }, { status: 400 });
    }

    // For cover downloads, no credit deduction needed (covers are free)
    if (contentType === 'cover') {
      return NextResponse.json({
        success: true,
        downloadUrl: instance.cover_image_url,
        contentType: 'cover',
        creditsUsed: 0,
        message: 'Cover download ready'
      });
    }

    // For video downloads, check and deduct credits
    if (contentType === 'video') {
      // Check if already downloaded (and thus already paid for)
      if (instance.downloaded) {
        return NextResponse.json({
          success: true,
          downloadUrl: instance.video_url,
          contentType: 'video',
          creditsUsed: 0,
          message: 'Video already purchased, download ready'
        });
      }

      // Determine model and download cost
      const model: 'veo3' | 'veo3_fast' = (instance.video_model === 'veo3' || instance.video_model === 'veo3_fast')
        ? instance.video_model
        : (instance.credits_cost === CREDIT_COSTS.veo3 ? 'veo3' : 'veo3_fast');

      const downloadCost = getCreditCost(model);
      
      // Check if user has enough credits
      const checkResult = await checkCredits(instance.user_id, downloadCost);
      
      if (!checkResult.success) {
        return NextResponse.json({ 
          error: checkResult.error || 'Failed to check credits' 
        }, { status: 500 });
      }
      
      if (!checkResult.hasEnoughCredits) {
        return NextResponse.json({ 
          error: 'Insufficient credits',
          required: downloadCost,
          current: checkResult.currentCredits || 0
        }, { status: 400 });
      }
      
      // Deduct credits
      const deductResult = await deductCredits(instance.user_id, downloadCost);
      
      if (!deductResult.success) {
        return NextResponse.json({ 
          error: deductResult.error || 'Failed to deduct credits' 
        }, { status: 500 });
      }

      // Mark as downloaded
      await supabase
        .from('user_history_v2')
        .update({
          downloaded: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', instanceId);

      // Record credit transaction with model in description
      // Note: credit_transactions.history_id references user_history (V1), not user_history_v2.
      // To avoid FK violation, do not attach history_id for V2; include the instance id in description instead.
      await recordCreditTransaction(
        instance.user_id,
        'usage',
        downloadCost,
        `Video download - workflow v2 (${model === 'veo3' ? 'VEO3 High Quality' : 'VEO3 Fast'})`,
        undefined,
        true
      );

      console.log(`✅ Deducted ${downloadCost} credits for video download, user: ${instance.user_id} (model: ${model})`);

      return NextResponse.json({
        success: true,
        downloadUrl: instance.video_url,
        contentType: 'video',
        creditsUsed: downloadCost,
        remainingCredits: deductResult.remainingCredits,
        message: 'Video download ready, credits deducted'
      });
    }

  } catch (error) {
    console.error('💥 Download content API error:', error);
    return NextResponse.json({
      error: 'Failed to process download',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
