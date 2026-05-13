import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import type { AiReferenceAngleAssetType, AiReferenceAngleJobStatus } from '@/lib/ai-reference-angle-jobs';
import { createKieGptImageTask } from '@/lib/kie-image-generation';
import { createJob, getJobsByIdsAndUser } from '@/lib/ai-reference-angle-store';
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
  getImageGenerationCreditCost,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';
import {
  getReferenceAngleAspectRatio,
  selectAnglePresets,
  type SourceAspect
} from '@/lib/ai-reference-angle-presets';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-base64-upload';

function getImageExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
  if (!match) return 'png';
  const ext = match[1].toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({
        error: 'Webhook URL not configured. Please contact support.',
        details: 'NEXT_PUBLIC_SITE_URL environment variable is required for AI reference angle generation.'
      }, { status: 500 });
    }

    const body = await request.json();
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const assetType = body?.assetType === 'avatar'
      ? 'avatar'
      : body?.assetType === 'product'
        ? 'product'
        : body?.assetType === 'universal'
          ? 'universal'
          : null;
    const sourceAspect = body?.sourceAspect === 'portrait' || body?.sourceAspect === 'square' || body?.sourceAspect === 'landscape'
      ? body.sourceAspect
      : undefined;
    const parsedExistingCount = Number(body?.existingReferenceCount);
    const existingReferenceCount = Number.isFinite(parsedExistingCount)
      ? Math.max(0, Math.min(Math.floor(parsedExistingCount), 3))
      : 0;
    const maxGeneratableCount = Math.max(0, 3 - existingReferenceCount);
    const parsedCount = Number(body?.count);
    const requestedCount = Number.isFinite(parsedCount)
      ? Math.floor(parsedCount)
      : maxGeneratableCount;
    const count = Math.max(1, Math.min(requestedCount, maxGeneratableCount || 1));

    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'A valid imageDataUrl is required' }, { status: 400 });
    }

    if (!assetType) {
      return NextResponse.json({ error: 'assetType must be avatar, product, or universal' }, { status: 400 });
    }

    if (maxGeneratableCount <= 0) {
      return NextResponse.json({ error: 'Reference images are already full (3/3).' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: getImageGenerationCreditCost(count),
      description: `AI Angle Generator - ${count} image${count === 1 ? '' : 's'}`,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    try {
      const extension = getImageExtensionFromDataUrl(imageDataUrl);
      const uploadResponse = await fetchWithRetry(KIE_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KIE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64Data: imageDataUrl,
          uploadPath: `assets/${assetType}/ai-reference-angles`,
          fileName: `${assetType}-primary-${Date.now()}.${extension}`
        })
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        await refundToolGenerationCredits({
          userId,
          amount: charge.chargedCredits,
          reason: 'AI Angle Generator source upload failed',
        });
        return NextResponse.json({ error: 'Failed to upload source image', details: uploadError }, { status: uploadResponse.status });
      }

      const uploadResult = await uploadResponse.json();
      const sourceImageUrl = uploadResult?.data?.downloadUrl as string | undefined;

      if (!uploadResult?.success || !sourceImageUrl) {
        await refundToolGenerationCredits({
          userId,
          amount: charge.chargedCredits,
          reason: 'AI Angle Generator source upload failed',
        });
        return NextResponse.json({ error: uploadResult?.msg || 'Source image upload failed' }, { status: 500 });
      }

      const presets = selectAnglePresets(assetType, existingReferenceCount, count);
      const callBackUrl = `${siteUrl}/api/assets/ai-reference-angles/webhooks`;
      const jobsPayload: Array<{
        user_id: string;
        asset_type: AiReferenceAngleAssetType;
        source_image_url: string;
        preset_key: string;
        preset_label: string;
        kie_task_id: string;
        status: AiReferenceAngleJobStatus;
        aspect_ratio: string;
      }> = [];

      for (const preset of presets) {
        const aspectRatio = getReferenceAngleAspectRatio(assetType, sourceAspect);
        const taskId = await createKieGptImageTask({
          prompt: preset.prompt,
          referenceImageUrls: [sourceImageUrl],
          aspectRatio,
          callBackUrl,
          moderationExternalId: `user_${userId}:ai_reference_angles:${assetType}:${preset.key}`
        }, 3, 30000);

        jobsPayload.push({
          user_id: userId,
          asset_type: assetType,
          source_image_url: sourceImageUrl,
          preset_key: preset.key,
          preset_label: preset.label,
          kie_task_id: taskId,
          status: 'processing',
          aspect_ratio: aspectRatio
        });
      }

      const createdJobs = jobsPayload.map((payload) =>
        createJob({
          userId: payload.user_id,
          assetType: payload.asset_type,
          sourceImageUrl: payload.source_image_url,
          presetKey: payload.preset_key,
          presetLabel: payload.preset_label,
          kieTaskId: payload.kie_task_id,
          aspectRatio: payload.aspect_ratio,
          billedCredits: IMAGE_GENERATION_CREDIT_COST,
        })
      );

      return NextResponse.json({
        success: true,
        jobs: createdJobs.map((job) => ({
          id: job.id,
          presetKey: job.preset_key,
          presetLabel: job.preset_label,
          status: job.status,
        })),
        sourceImageUrl,
      });
    } catch (error) {
      await refundToolGenerationCredits({
        userId,
        amount: charge.chargedCredits,
        reason: 'AI Angle Generator failed to start',
      });
      throw error;
    }
  } catch (error) {
    console.error('[ai-reference-angles] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobIds = searchParams.getAll('jobId').filter(Boolean);
    if (!jobIds.length) {
      return NextResponse.json({ error: 'At least one jobId is required' }, { status: 400 });
    }

    const jobsList = getJobsByIdsAndUser(jobIds, userId);
    const orderedJobs = jobIds
      .map((jobId) => jobsList.find((job) => job.id === jobId))
      .filter(Boolean);

    return NextResponse.json({ success: true, jobs: orderedJobs });
  } catch (error) {
    console.error('[ai-reference-angles] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
