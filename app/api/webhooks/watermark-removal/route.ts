import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { extractResultVideoUrl } from '@/lib/kie-watermark-removal';

/**
 * Webhook endpoint for KIE API callbacks
 * KIE sends the same structure as Query Task API response
 */
export async function POST(request: NextRequest) {
  try {
    const callbackData = await request.json();

    console.log('🔔 Received watermark removal webhook:', {
      taskId: callbackData.data?.taskId,
      state: callbackData.data?.state,
    });

    if (!callbackData.data?.taskId) {
      console.error('Invalid callback data: missing taskId');
      return NextResponse.json({ error: 'Invalid callback data' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Find project by task ID
    const { data: project, error: fetchError } = await supabase
      .from('sora2_watermark_removal_tasks')
      .select('*')
      .eq('kie_task_id', callbackData.data.taskId)
      .single();

    if (fetchError || !project) {
      console.error('Project not found for task ID:', callbackData.data.taskId);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { state, resultJson, failMsg } = callbackData.data;

    if (state === 'success') {
      const resultVideoUrl = extractResultVideoUrl(resultJson);

      await supabase
        .from('sora2_watermark_removal_tasks')
        .update({
          status: 'completed',
          output_video_url: resultVideoUrl,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      console.log('✅ Watermark removal completed:', project.id);
    } else if (state === 'fail') {
      await supabase
        .from('sora2_watermark_removal_tasks')
        .update({
          status: 'failed',
          error_message: failMsg || 'Watermark removal failed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      console.log('❌ Watermark removal failed:', project.id, failMsg);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
