import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  createAdShortFilmJob,
  executeWorkflow,
  pollAdShortFilmJobStatus,
} from '@/lib/ad-short-film-workflow';
import { getJob } from '@/lib/ad-short-film-job-store';
import {
  AD_SHORT_FILM_TOTAL_CREDIT_COST,
  chargeToolGenerationCredits,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'poll') {
      const { jobId } = body;
      if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
      }

      const status = await pollAdShortFilmJobStatus(jobId);
      return NextResponse.json({ success: true, jobId, ...status });
    }

    // Default: create new ad short film job
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { productPhotoDataUrl } = body;

    if (!productPhotoDataUrl) {
      return NextResponse.json({ error: 'Missing productPhotoDataUrl' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: AD_SHORT_FILM_TOTAL_CREDIT_COST,
      description: 'AI Ad Short Film - 15s video generation',
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    let result;
    try {
      result = await createAdShortFilmJob({
        productPhotoDataUrl,
        userId,
        billedCredits: charge.chargedCredits,
      });
    } catch (error) {
      await refundToolGenerationCredits({
        userId,
        amount: charge.chargedCredits,
        reason: 'AI Ad Short Film failed to start',
      });
      throw error;
    }

    // Fire-and-forget workflow execution
    executeWorkflow(result.jobId, productPhotoDataUrl, userId).catch(
      console.error
    );

    return NextResponse.json(
      { success: true, jobId: result.jobId, status: 'uploading' },
      { status: 202 }
    );
  } catch (error) {
    console.error('[tools/ad-short-film] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const status = await pollAdShortFilmJobStatus(jobId);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: status.status,
      storyboardPrompt: status.storyboardPrompt,
      storyboardImageUrl: status.storyboardImageUrl,
      videoUrl: status.videoUrl,
      errorMessage: status.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('[tools/ad-short-film] GET Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
