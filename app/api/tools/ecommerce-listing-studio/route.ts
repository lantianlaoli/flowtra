import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  chargeToolGenerationCredits,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';
import {
  IMAGE_GENERATION_CREDIT_COST,
  getEcommerceListingStudioCreditCost,
} from '@/lib/tools/billing-constants';
import {
  analyzeProductForEcommerceListing,
  buildEcommerceListingImageSlots,
  buildEcommerceListingStoryboardPrompt,
  buildEcommerceListingVideoPrompt,
  fallbackEcommerceListingBrief,
  normalizeEcommerceListingScopes,
  normalizeImageAspectRatio,
  normalizeImageResolution,
  normalizeTextLanguage,
  normalizeVideoAspectRatio,
  normalizeVideoModel,
  normalizeVideoResolution,
  type EcommerceListingAssetScope,
  type EcommerceListingMetadata,
} from '@/lib/tools/ecommerce-listing-studio';
import {
  createToolGenerationJob,
  createToolGenerationTask,
  getToolGenerationJob,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

async function uploadProductImage(dataUrl: string, fileName: string) {
  const response = await fetchWithRetry(
    KIE_UPLOAD_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data: dataUrl,
        uploadPath: 'flowtra/ecommerce-listing-studio',
        fileName,
      }),
    },
    3,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE upload failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const downloadUrl = payload?.data?.downloadUrl;
  if (!payload?.success || typeof downloadUrl !== 'string') {
    throw new Error(payload?.msg || 'KIE upload did not return a download URL.');
  }
  return downloadUrl;
}

async function createKieImageTask(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: string;
  resolution: string;
  callBackUrl: string;
}) {
  const response = await fetchWithRetry(
    KIE_CREATE_TASK_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL,
        input: {
          prompt: input.prompt,
          input_urls: input.inputUrls.slice(0, 16),
          aspect_ratio: input.aspectRatio,
          resolution: input.resolution,
          nsfw_checker: true,
        },
        callBackUrl: input.callBackUrl,
      }),
    },
    5,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE image task creation failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (payload?.code !== 200 || typeof taskId !== 'string') {
    throw new Error(payload?.msg || 'KIE image task creation did not return a taskId.');
  }
  return taskId;
}

function selectedScope(scopes: EcommerceListingAssetScope[], scope: EcommerceListingAssetScope) {
  return scopes.includes(scope);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER API key not configured' }, { status: 500 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL not configured' }, { status: 500 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const productPhotoDataUrls = Array.isArray(body.productPhotoDataUrls)
      ? body.productPhotoDataUrls.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('data:image/'))
      : [];
    if (productPhotoDataUrls.length === 0) {
      return NextResponse.json({ error: 'At least one product photo is required.' }, { status: 400 });
    }
    if (productPhotoDataUrls.length > 3) {
      return NextResponse.json({ error: 'Upload up to 3 product photos.' }, { status: 400 });
    }

    const assetScopes = normalizeEcommerceListingScopes(body.assetScopes);
    const textLanguage = normalizeTextLanguage(body.textLanguage);
    const imageAspectRatio = normalizeImageAspectRatio(body.imageAspectRatio);
    const imageResolution = normalizeImageResolution(body.imageResolution);
    const videoModel = normalizeVideoModel(body.videoModel);
    const videoAspectRatio = normalizeVideoAspectRatio(body.videoAspectRatio, videoModel);
    const videoResolution = normalizeVideoResolution(body.videoResolution, videoModel);
    const customRequirements =
      typeof body.customRequirements === 'string' ? body.customRequirements.trim().slice(0, 2000) : '';
    const billedCredits = getEcommerceListingStudioCreditCost({
      carousel: selectedScope(assetScopes, 'carousel'),
      detail: selectedScope(assetScopes, 'detail'),
      video: selectedScope(assetScopes, 'video'),
      videoModel,
      videoResolution,
    });

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: billedCredits,
      description: 'Ecommerce Listing Studio generation',
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    let job: Awaited<ReturnType<typeof createToolGenerationJob>> | null = null;
    try {
      // Schema verified via Supabase MCP (2026-05-22):
      // tool_generation_jobs has metadata, status, billed_credits, error/refund fields.
      // tool_generation_tasks has kie_task_id, tool_key, status, result_url, metadata.
      job = await createToolGenerationJob({
        userId,
        toolKey: 'ecommerce-listing-studio',
        status: 'uploading',
        billedCredits: charge.chargedCredits,
        metadata: {
          asset_scopes: assetScopes,
          text_language: textLanguage,
          image_aspect_ratio: imageAspectRatio,
          image_resolution: imageResolution,
          video_model: videoModel,
          video_aspect_ratio: videoAspectRatio,
          video_resolution: videoResolution,
          custom_requirements: customRequirements || undefined,
        },
      });

      const productImageUrls = await Promise.all(
        productPhotoDataUrls.map((dataUrl: string, index: number) =>
          uploadProductImage(dataUrl, `ecommerce_listing_${job!.id}_${index + 1}.jpg`)
        )
      );

      await updateToolGenerationJob(job.id, {
        status: 'processing',
        metadata: {
          asset_scopes: assetScopes,
          text_language: textLanguage,
          image_aspect_ratio: imageAspectRatio,
          image_resolution: imageResolution,
          video_model: videoModel,
          video_aspect_ratio: videoAspectRatio,
          video_resolution: videoResolution,
          custom_requirements: customRequirements || undefined,
          product_image_urls: productImageUrls,
        },
      });

      let brief;
      try {
        brief = await analyzeProductForEcommerceListing({
          productImageUrls,
          textLanguage,
          customRequirements: customRequirements || undefined,
        });
      } catch (error) {
        console.error('[ecommerce-listing-studio] Product analysis failed, using fallback:', error);
        brief = fallbackEcommerceListingBrief(textLanguage);
        if (customRequirements) brief.customRequirements = customRequirements;
      }

      const imageSlots = buildEcommerceListingImageSlots({
        brief,
        textLanguage,
        numViews: productImageUrls.length,
        assetScopes,
      });
      const carouselImages = imageSlots.filter((slot) => slot.kind === 'carousel');
      const detailImages = imageSlots.filter((slot) => slot.kind === 'detail');
      const videoPrompt = selectedScope(assetScopes, 'video')
        ? buildEcommerceListingVideoPrompt({ brief, textLanguage, numViews: productImageUrls.length })
        : '';
      const baseMetadata: EcommerceListingMetadata = {
        asset_scopes: assetScopes,
        text_language: textLanguage,
        image_aspect_ratio: imageAspectRatio,
        image_resolution: imageResolution,
        video_model: videoModel,
        video_aspect_ratio: videoAspectRatio,
        video_resolution: videoResolution,
        custom_requirements: customRequirements || undefined,
        product_image_urls: productImageUrls,
        brief,
        carousel_images: carouselImages,
        detail_images: detailImages,
        video: selectedScope(assetScopes, 'video') ? { status: 'waiting', prompt: videoPrompt } : undefined,
        total_outputs: imageSlots.length + (selectedScope(assetScopes, 'video') ? 1 : 0),
        completed_outputs: 0,
      };

      await updateToolGenerationJob(job.id, { metadata: baseMetadata });

      const callBackUrl = `${siteUrl}/api/tools/webhooks/kie`;
      const nextCarousel = [...carouselImages];
      const nextDetail = [...detailImages];
      for (const slot of imageSlots) {
        const taskId = await createKieImageTask({
          prompt: slot.prompt,
          inputUrls: productImageUrls,
          aspectRatio: imageAspectRatio,
          resolution: imageResolution,
          callBackUrl,
        });
        await createToolGenerationTask({
          jobId: job.id,
          kieTaskId: taskId,
          toolKey: 'ecommerce-listing-studio',
          metadata: { stage: 'image', slot_id: slot.id, kind: slot.kind, index: slot.index },
        });
        const updatedSlot = { ...slot, taskId, status: 'processing' as const };
        if (slot.kind === 'carousel') {
          nextCarousel[slot.index - 1] = updatedSlot;
        } else {
          nextDetail[slot.index - 1] = updatedSlot;
        }
      }

      let nextVideo = baseMetadata.video;
      if (selectedScope(assetScopes, 'video')) {
        const storyboardPrompt = buildEcommerceListingStoryboardPrompt({
          brief,
          textLanguage,
          numViews: productImageUrls.length,
        });
        const storyboardTaskId = await createKieImageTask({
          prompt: storyboardPrompt,
          inputUrls: productImageUrls,
          aspectRatio: videoAspectRatio,
          resolution: imageResolution,
          callBackUrl,
        });
        await createToolGenerationTask({
          jobId: job.id,
          kieTaskId: storyboardTaskId,
          toolKey: 'ecommerce-listing-studio',
          metadata: { stage: 'storyboard_image' },
        });
        nextVideo = { status: 'processing', prompt: videoPrompt, storyboardTaskId };
      }

      const latestJob = await getToolGenerationJob(job.id);
      const latestMetadata = (latestJob?.metadata ?? baseMetadata) as EcommerceListingMetadata;
      const mergeSlotState = (nextSlot: typeof nextCarousel[number], latestSlots: typeof nextCarousel) => {
        const latestSlot = latestSlots.find((slot) => slot.id === nextSlot.id);
        return latestSlot?.status === 'success' || latestSlot?.status === 'fail'
          ? latestSlot
          : { ...latestSlot, ...nextSlot };
      };
      const latestVideo = latestMetadata.video;
      const metadata: EcommerceListingMetadata = {
        ...baseMetadata,
        ...latestMetadata,
        carousel_images: nextCarousel.map((slot) => mergeSlotState(slot, latestMetadata.carousel_images ?? [])),
        detail_images: nextDetail.map((slot) => mergeSlotState(slot, latestMetadata.detail_images ?? [])),
        video:
          latestVideo?.status === 'success' || latestVideo?.status === 'fail'
            ? latestVideo
            : latestVideo || nextVideo
              ? { ...(latestVideo ?? { status: 'waiting' as const, prompt: '' }), ...(nextVideo ?? {}) }
              : undefined,
      };
      await updateToolGenerationJob(job.id, {
        status: 'processing',
        metadata,
        billed_credits: charge.chargedCredits,
      });

      return NextResponse.json({ success: true, jobId: job.id, status: 'processing' }, { status: 202 });
    } catch (error) {
      if (job) {
        await refundToolGenerationCredits({
          userId,
          amount: charge.chargedCredits,
          reason: 'Ecommerce Listing Studio failed to start',
          historyId: job.id,
        });
        await updateToolGenerationJob(job.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Failed to start generation',
          billing_refunded_at: new Date().toISOString(),
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[tools/ecommerce-listing-studio] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
