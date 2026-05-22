import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import type { AiReferenceAngleAssetType } from '@/lib/ai-reference-angle-jobs';
import { createKieGptImageTask } from '@/lib/kie-image-generation';
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
  getImageGenerationCreditCost,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';
import {
  createToolGenerationJob,
  createToolGenerationTask,
  getToolGenerationJob,
  getToolGenerationJobsByUser,
  getToolGenerationTasksByJobId,
  getToolGenerationTasksByKieTaskIds,
  type ToolGenerationTask,
} from '@/lib/tools/job-store';
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

      // Create parent job in Supabase
      const job = await createToolGenerationJob({
        userId,
        toolKey: 'ai-reference-angle',
        status: 'processing',
        metadata: {
          asset_type: assetType,
          source_image_url: sourceImageUrl,
          count,
        },
        billedCredits: charge.chargedCredits,
      });

      const presets = selectAnglePresets(assetType, existingReferenceCount, count);
      const callBackUrl = `${siteUrl}/api/tools/webhooks/kie`;
      const tasksPayload: Array<{ id: string; presetKey: string; presetLabel: string; status: string }> = [];

      for (const preset of presets) {
        const aspectRatio = getReferenceAngleAspectRatio(assetType, sourceAspect);
        const taskId = await createKieGptImageTask({
          prompt: preset.prompt,
          referenceImageUrls: [sourceImageUrl],
          aspectRatio,
          callBackUrl,
          moderationExternalId: `user_${userId}:ai_reference_angles:${assetType}:${preset.key}`
        }, 3, 30000);

        await createToolGenerationTask({
          jobId: job.id,
          kieTaskId: taskId,
          toolKey: 'ai-reference-angle',
          metadata: {
            preset_key: preset.key,
            preset_label: preset.label,
            aspect_ratio: aspectRatio,
            asset_type: assetType,
          },
        });

        tasksPayload.push({
          id: taskId,
          presetKey: preset.key,
          presetLabel: preset.label,
          status: 'processing',
        });
      }

      const legacyJobs = tasksPayload.map((task) => ({
        id: task.id,
        presetKey: task.presetKey,
        presetLabel: task.presetLabel,
        status: task.status,
      }));

      return NextResponse.json({
        success: true,
        jobId: job.id,
        jobs: legacyJobs,
        tasks: tasksPayload,
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

    const taskMatches = await getToolGenerationTasksByKieTaskIds(jobIds);
    if (taskMatches.length > 0) {
      const legacyJobs = await Promise.all(
        taskMatches.map(async (task) => {
          const job = await getToolGenerationJob(task.job_id);
          if (!job || job.user_id !== userId || job.tool_key !== 'ai-reference-angle') return null;
          return mapAiReferenceTaskToLegacyJob(task, job);
        })
      );

      const orderedJobs = jobIds
        .map((jobId) => legacyJobs.find((job) => job?.id === jobId))
        .filter(Boolean);

      return NextResponse.json({ success: true, jobs: orderedJobs });
    }

    const jobs = await getToolGenerationJobsByUser(userId, 'ai-reference-angle');
    const filteredJobs = jobs.filter((j) => jobIds.includes(j.id));

    // Enrich with tasks
    const enrichedJobs = await Promise.all(
      filteredJobs.map(async (job) => {
        const tasks = await getToolGenerationTasksByJobId(job.id);
        return { ...job, tasks };
      })
    );

    return NextResponse.json({ success: true, jobs: enrichedJobs });
  } catch (error) {
    console.error('[ai-reference-angles] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapAiReferenceTaskToLegacyJob(
  task: ToolGenerationTask,
  job: { user_id: string; metadata: Record<string, unknown>; billed_credits?: number; billing_refunded_at?: string | null }
) {
  const taskMetadata = task.metadata ?? {};
  const jobMetadata = job.metadata ?? {};

  return {
    id: task.kie_task_id,
    user_id: job.user_id,
    asset_type: taskMetadata.asset_type || jobMetadata.asset_type || 'universal',
    source_image_url: jobMetadata.source_image_url || '',
    preset_key: taskMetadata.preset_key || '',
    preset_label: taskMetadata.preset_label || '',
    kie_task_id: task.kie_task_id,
    status: task.status,
    result_image_url: task.result_url,
    error_message: task.error_message,
    webhook_received_at: task.webhook_received_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
    aspect_ratio: taskMetadata.aspect_ratio || null,
    billed_credits: job.billed_credits,
    billing_refunded_at: job.billing_refunded_at,
  };
}
