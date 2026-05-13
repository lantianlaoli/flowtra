import { NextRequest, NextResponse } from 'next/server';
import { getJobByKieTaskId, updateJob } from '@/lib/ai-reference-angle-store';
import { refundToolGenerationCredits } from '@/lib/tools/billing';

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

    const job = getJobByKieTaskId(taskId);

    if (!job) {
      console.warn('[AI Reference Angle Webhook] Task not found:', taskId);
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 200 });
    }

    // Race guard: first successful completion wins; ignore later webhooks.
    if (job.status === 'completed') {
      return NextResponse.json({ success: true, message: 'Already completed' }, { status: 200 });
    }

    const resultImageUrl = parseResultUrl(data);
    const webhookReceivedAt = new Date().toISOString();

    if (code === 200 && state === 'success' && resultImageUrl) {
      const updated = updateJob(taskId, {
        status: 'completed',
        resultImageUrl,
        errorMessage: null,
        webhookReceivedAt,
      });

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Failed to update job' }, { status: 200 });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    const errorMessage =
      failMsg || msg || (failCode ? `KIE task failed with code ${failCode}` : 'AI reference angle generation failed.');
    if (state !== 'waiting' && job.billed_credits > 0 && !job.billing_refunded_at) {
      await refundToolGenerationCredits({
        userId: job.user_id,
        amount: job.billed_credits,
        reason: 'AI Angle Generator image failed',
        historyId: job.id,
      });
    }
    updateJob(taskId, {
      status: state === 'waiting' ? 'processing' : 'failed',
      errorMessage: state === 'waiting' ? null : errorMessage,
      webhookReceivedAt: state === 'waiting' ? null : webhookReceivedAt,
      billingRefundedAt: state === 'waiting' ? null : new Date().toISOString(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[AI Reference Angle Webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 200 });
  }
}
