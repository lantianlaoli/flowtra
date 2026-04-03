import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface KIEImageWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'success' | 'fail' | 'waiting';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    response?: {
      resultUrls?: string[];
    };
    resultUrls?: string[];
  };
}

function parseResultUrl(data: KIEImageWebhookPayload['data']): string | null {
  if (Array.isArray(data.response?.resultUrls) && data.response.resultUrls[0]) {
    return data.response.resultUrls[0];
  }

  if (Array.isArray(data.resultUrls) && data.resultUrls[0]) {
    return data.resultUrls[0];
  }

  if (typeof data.resultJson === 'string') {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      if (Array.isArray(parsed.resultUrls) && parsed.resultUrls[0]) {
        return parsed.resultUrls[0];
      }
    } catch (error) {
      console.error('[AI Reference Angle Webhook] Failed to parse resultJson:', error);
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload: KIEImageWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, state, failCode, failMsg } = data;

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 200 });
    }

    // Schema verified via Supabase MCP (2026-04-03):
    // ai_reference_angle_jobs columns: id, kie_task_id, status, result_image_url, error_message, webhook_received_at.
    const supabase = getSupabaseAdmin();
    const { data: job, error: fetchError } = await supabase
      .from('ai_reference_angle_jobs')
      .select('id, kie_task_id, status, webhook_received_at')
      .eq('kie_task_id', taskId)
      .single();

    if (fetchError || !job) {
      console.warn('[AI Reference Angle Webhook] Task not found:', taskId);
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 200 });
    }

    if (job.webhook_received_at) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const resultImageUrl = parseResultUrl(data);
    const webhookReceivedAt = new Date().toISOString();

    if (code === 200 && state === 'success' && resultImageUrl) {
      const { error: updateError } = await supabase
        .from('ai_reference_angle_jobs')
        .update({
          status: 'completed',
          result_image_url: resultImageUrl,
          error_message: null,
          webhook_received_at: webhookReceivedAt,
          updated_at: webhookReceivedAt
        })
        .eq('id', job.id);

      if (updateError) {
        console.error('[AI Reference Angle Webhook] Failed to update job:', updateError);
        return NextResponse.json({ success: false, error: 'Database update failed' }, { status: 200 });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    const errorMessage = failMsg || msg || (failCode ? `KIE task failed with code ${failCode}` : 'AI reference angle generation failed.');
    await supabase
      .from('ai_reference_angle_jobs')
      .update({
        status: state === 'waiting' ? 'processing' : 'failed',
        error_message: state === 'waiting' ? null : errorMessage,
        webhook_received_at: state === 'waiting' ? null : webhookReceivedAt,
        updated_at: webhookReceivedAt
      })
      .eq('id', job.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[AI Reference Angle Webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 200 });
  }
}
