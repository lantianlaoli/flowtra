import { NextRequest, NextResponse } from 'next/server';
import { createImageCloneTask, pollImageCloneJobStatus, regenerateImageClone } from '@/lib/image-clone';
import { getJob } from '@/lib/image-clone-job-store';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'poll') {
      // Poll job status
      const { jobId } = data;
      if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
      }

      const status = await pollImageCloneJobStatus(jobId);
      return NextResponse.json({ success: true, ...status });
    }

    if (action === 'regenerate') {
      // Regenerate with refinement
      const { jobId, refinementText } = data;
      if (!jobId || !refinementText) {
        return NextResponse.json({ error: 'Missing jobId or refinementText' }, { status: 400 });
      }

      const result = await regenerateImageClone(jobId, refinementText);
      return NextResponse.json({ success: true, jobId: result.jobId, kieTaskId: result.kieTaskId, status: result.status });
    }

    // Default: create new image clone job
    const { productPhotoDataUrl, referencePhotoDataUrls, userRequirement, copyText, styleDirection, aspectRatio, resolution, userId } = data;

    if (!productPhotoDataUrl) {
      return NextResponse.json({ error: 'Missing productPhotoDataUrl' }, { status: 400 });
    }

    if (!userRequirement) {
      return NextResponse.json({ error: 'Missing userRequirement' }, { status: 400 });
    }

    if (!aspectRatio || !['1:1', '9:16', '16:9', '4:3', '3:4'].includes(aspectRatio)) {
      return NextResponse.json({ error: 'Invalid aspectRatio' }, { status: 400 });
    }

    if (!resolution || !['1K', '2K', '4K'].includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 });
    }

    const result = await createImageCloneTask({
      productPhotoDataUrl,
      referencePhotoDataUrls: referencePhotoDataUrls || [],
      userRequirement,
      copyText: copyText || '',
      styleDirection: styleDirection || '',
      aspectRatio,
      resolution,
      userId: userId || 'anonymous',
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      kieTaskId: result.kieTaskId,
      status: result.status,
    });
  } catch (error) {
    console.error('[tools/image-clone] Error:', error);
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

    // Poll KIE for latest status
    const status = await pollImageCloneJobStatus(jobId);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: status.status,
      resultImageUrl: status.resultImageUrl,
      errorMessage: status.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('[tools/image-clone] GET Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
