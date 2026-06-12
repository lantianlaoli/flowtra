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
  analyzeManufacturerPromoForEcommerceListing,
  analyzeProductForEcommerceListing,
  buildManufacturerPromoCarouselPrompt,
  buildEcommerceListingImageSlots,
  buildEcommerceListingStoryboardPrompt,
  buildEcommerceListingVideoPrompt,
  fallbackEcommerceListingBrief,
  fallbackManufacturerPromoAnalysis,
  getBrandLogoNote,
  getPetReplacementNote,
  normalizeEcommerceListingCategory,
  normalizeEcommerceListingScopes,
  normalizeImageAspectRatio,
  normalizeImageResolution,
  normalizeLogoCorner,
  normalizeSourceMode,
  normalizeTextLanguage,
  normalizeVideoAspectRatio,
  normalizeVideoModel,
  normalizeVideoResolution,
  type EcommerceListingAssetScope,
  type EcommerceListingImageSlot,
  type EcommerceListingMetadata,
} from '@/lib/tools/ecommerce-listing-studio';
import {
  createToolGenerationJob,
  createToolGenerationTask,
  getToolGenerationJob,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';
import { getUserPetById } from '@/lib/supabase';
import { assertKieCreditsAvailable } from '@/lib/kie-credits-check';

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const PRODUCT_PHOTO_LIMIT = 6;
const MANUFACTURER_PROMO_LIMIT = 6;

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

async function uploadKieImage(dataUrl: string, fileName: string, uploadPath = 'flowtra/ecommerce-listing-studio') {
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
        uploadPath,
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

async function uploadProductImage(dataUrl: string, fileName: string) {
  return uploadKieImage(dataUrl, fileName);
}

async function createKieImageTask(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: string;
  resolution: string;
  callBackUrl: string;
}) {
  await assertKieCreditsAvailable();
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
    const sourceMode = normalizeSourceMode(body.sourceMode);
    const category = normalizeEcommerceListingCategory(body.category);
    const productPhotoDataUrls = Array.isArray(body.productPhotoDataUrls)
      ? body.productPhotoDataUrls.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('data:image/'))
      : [];
    const manufacturerPromoDataUrls = Array.isArray(body.manufacturerPromoDataUrls)
      ? body.manufacturerPromoDataUrls.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('data:image/'))
      : [];
    const petPhotoDataUrls =
      body.petPhotoDataUrls && typeof body.petPhotoDataUrls === 'object'
        ? {
            front:
              typeof body.petPhotoDataUrls.front === 'string' && body.petPhotoDataUrls.front.startsWith('data:image/')
                ? body.petPhotoDataUrls.front
                : null,
            side:
              typeof body.petPhotoDataUrls.side === 'string' && body.petPhotoDataUrls.side.startsWith('data:image/')
                ? body.petPhotoDataUrls.side
                : null,
            back:
              typeof body.petPhotoDataUrls.back === 'string' && body.petPhotoDataUrls.back.startsWith('data:image/')
                ? body.petPhotoDataUrls.back
                : null,
          }
        : undefined;
    const brandLogoDataUrl =
      body.brandLogoEnabled === true &&
      typeof body.brandLogoDataUrl === 'string' &&
      body.brandLogoDataUrl.startsWith('data:image/')
        ? body.brandLogoDataUrl
        : undefined;
    const brandLogoCorner = normalizeLogoCorner(body.brandLogoCorner);
    const petId = typeof body.petId === 'string' && body.petId.trim() ? body.petId.trim() : undefined;
    if (
      body.petReplacementEnabled === true &&
      (sourceMode !== 'manufacturer-promos' || category !== 'pet')
    ) {
      return NextResponse.json(
        { error: 'Pet replacement is only available for Pet + Manufacturer Carousel.' },
        { status: 400 }
      );
    }
    const petReplacementEnabled =
      sourceMode === 'manufacturer-promos' && category === 'pet' && body.petReplacementEnabled === true;

    if (sourceMode === 'manufacturer-promos') {
      if (manufacturerPromoDataUrls.length === 0) {
        return NextResponse.json({ error: 'At least one manufacturer promo image is required.' }, { status: 400 });
      }
      if (manufacturerPromoDataUrls.length > MANUFACTURER_PROMO_LIMIT) {
        return NextResponse.json({ error: `Upload up to ${MANUFACTURER_PROMO_LIMIT} manufacturer promo images.` }, { status: 400 });
      }
      if (
        petReplacementEnabled &&
        !petId &&
        (!petPhotoDataUrls?.front || !petPhotoDataUrls.side || !petPhotoDataUrls.back)
      ) {
        return NextResponse.json(
          { error: 'Pet replacement requires a saved pet or front, side, and back pet photos.' },
          { status: 400 }
        );
      }
    } else if (productPhotoDataUrls.length === 0) {
      return NextResponse.json({ error: 'At least one product photo is required.' }, { status: 400 });
    }
    if (productPhotoDataUrls.length > PRODUCT_PHOTO_LIMIT) {
      return NextResponse.json({ error: `Upload up to ${PRODUCT_PHOTO_LIMIT} product photos.` }, { status: 400 });
    }

    let savedPetImageUrls: string[] = [];
    let resolvedPetId: string | undefined;
    if (petReplacementEnabled && petId) {
      const pet = await getUserPetById(petId, userId);
      if (!pet || !pet.front_photo_url || !pet.side_photo_url || !pet.back_photo_url) {
        return NextResponse.json({ error: 'Saved pet not found or incomplete.' }, { status: 400 });
      }
      resolvedPetId = pet.id;
      savedPetImageUrls = [pet.front_photo_url, pet.side_photo_url, pet.back_photo_url];
    }

    const assetScopes = sourceMode === 'manufacturer-promos'
      ? (['carousel'] as EcommerceListingAssetScope[])
      : normalizeEcommerceListingScopes(body.assetScopes);
    const textLanguage = normalizeTextLanguage(body.textLanguage);
    const imageAspectRatio = normalizeImageAspectRatio(body.imageAspectRatio);
    const imageResolution = normalizeImageResolution(body.imageResolution);
    const videoModel = normalizeVideoModel(body.videoModel);
    const videoAspectRatio = normalizeVideoAspectRatio(body.videoAspectRatio, videoModel);
    const videoResolution = normalizeVideoResolution(body.videoResolution, videoModel);
    const customRequirements =
      typeof body.customRequirements === 'string' ? body.customRequirements.trim().slice(0, 2000) : '';
    const billedCredits =
      sourceMode === 'manufacturer-promos'
        ? manufacturerPromoDataUrls.length * IMAGE_GENERATION_CREDIT_COST
        : getEcommerceListingStudioCreditCost({
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
      job = await createToolGenerationJob({
        userId,
        toolKey: 'ecommerce-listing-studio',
        status: 'uploading',
        billedCredits: charge.chargedCredits,
        metadata: {
          source_mode: sourceMode,
          category,
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

      if (sourceMode === 'manufacturer-promos') {
        const manufacturerPromoImageUrls = await Promise.all(
          manufacturerPromoDataUrls.map((dataUrl: string, index: number) =>
            uploadKieImage(
              dataUrl,
              `ecommerce_listing_manufacturer_${job!.id}_${index + 1}.jpg`,
              'flowtra/ecommerce-listing-studio/manufacturer-promos'
            )
          )
        );

        let brandLogoImageUrl: string | undefined;
        if (brandLogoDataUrl) {
          brandLogoImageUrl = await uploadKieImage(
            brandLogoDataUrl,
            `ecommerce_listing_brand_logo_${job.id}.png`,
            'flowtra/ecommerce-listing-studio/brand-logos'
          );
        }
        const orderedPetViews: Array<'front' | 'side' | 'back'> = ['front', 'side', 'back'];
        let petImageUrls: string[] = [];
        if (petReplacementEnabled && savedPetImageUrls.length === 3) {
          petImageUrls = savedPetImageUrls;
        } else if (petReplacementEnabled && petPhotoDataUrls) {
          petImageUrls = await Promise.all(
            orderedPetViews.map((view) =>
              uploadKieImage(
                petPhotoDataUrls[view]!,
                `ecommerce_listing_pet_${view}_${job!.id}.jpg`,
                'flowtra/ecommerce-listing-studio/pets'
              )
            )
          );
        }
        const brandLogoNote = brandLogoImageUrl ? getBrandLogoNote(textLanguage, brandLogoCorner) : undefined;
        const petReplacementNote = petImageUrls.length === 3 ? getPetReplacementNote(textLanguage) : undefined;
        const analyses = await Promise.all(
          manufacturerPromoImageUrls.map(async (imageUrl, index) => {
            try {
              return await analyzeManufacturerPromoForEcommerceListing({ imageUrl, textLanguage });
            } catch (error) {
              console.error(
                `[ecommerce-listing-studio] Manufacturer promo analysis failed for image ${index + 1}, using fallback:`,
                error
              );
              return fallbackManufacturerPromoAnalysis(textLanguage);
            }
          })
        );
        const carouselImages: EcommerceListingImageSlot[] = analyses.map((analysis, index) => ({
          id: `manufacturer-carousel-${index + 1}`,
          kind: 'carousel' as const,
          index: index + 1,
          sourceIndex: index,
          title: `Manufacturer Image ${index + 1}`,
          status: 'waiting' as const,
          prompt: buildManufacturerPromoCarouselPrompt({
            analysis,
            customRequirements: customRequirements || undefined,
            textLanguage,
            sourceIndex: index,
            petReplacementNote: analysis.hasRealPetSubject ? petReplacementNote : undefined,
            brandLogoNote,
          }),
        }));
        const baseMetadata: EcommerceListingMetadata = {
          source_mode: sourceMode,
          category,
          asset_scopes: assetScopes,
          text_language: textLanguage,
          image_aspect_ratio: imageAspectRatio,
          image_resolution: imageResolution,
          custom_requirements: customRequirements || undefined,
          manufacturer_promo_image_urls: manufacturerPromoImageUrls,
          manufacturer_promo_analyses: analyses,
          carousel_images: carouselImages,
          detail_images: [],
          brand_logo: brandLogoImageUrl
            ? { enabled: true, corner: brandLogoCorner, logo_image_url: brandLogoImageUrl }
            : undefined,
          pet_replacement: petImageUrls.length === 3
            ? { enabled: true, pet_id: resolvedPetId, pet_image_urls: petImageUrls }
            : undefined,
          total_outputs: carouselImages.length,
          completed_outputs: 0,
        };
        await updateToolGenerationJob(job.id, { status: 'processing', metadata: baseMetadata });

        const callBackUrl = `${siteUrl}/api/tools/webhooks/kie`;
        const nextCarousel = [...carouselImages];
        for (const slot of carouselImages) {
          const slotAnalysis = analyses[slot.index - 1];
          const shouldUsePetReplacement = petImageUrls.length === 3 && slotAnalysis?.hasRealPetSubject === true;
          const inputUrls = [
            manufacturerPromoImageUrls[slot.index - 1],
            ...(brandLogoImageUrl ? [brandLogoImageUrl] : []),
            ...(shouldUsePetReplacement ? petImageUrls : []),
          ];
          const taskId = await createKieImageTask({
            prompt: slot.prompt,
            inputUrls,
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
          nextCarousel[slot.index - 1] = { ...slot, taskId, status: 'processing' as const };
        }

        const latestJob = await getToolGenerationJob(job.id);
        const latestMetadata = (latestJob?.metadata ?? baseMetadata) as EcommerceListingMetadata;
        const metadata: EcommerceListingMetadata = {
          ...baseMetadata,
          ...latestMetadata,
          carousel_images: nextCarousel.map((slot) => {
            const latestSlot = latestMetadata.carousel_images?.find((candidate) => candidate.id === slot.id);
            return latestSlot?.status === 'success' || latestSlot?.status === 'fail'
              ? latestSlot
              : { ...latestSlot, ...slot };
          }),
          detail_images: [],
          video: undefined,
        };
        await updateToolGenerationJob(job.id, {
          status: 'processing',
          metadata,
          billed_credits: charge.chargedCredits,
        });

        return NextResponse.json({ success: true, jobId: job.id, status: 'processing' }, { status: 202 });
      }

      const productImageUrls = await Promise.all(
        productPhotoDataUrls.map((dataUrl: string, index: number) =>
          uploadProductImage(dataUrl, `ecommerce_listing_${job!.id}_${index + 1}.jpg`)
        )
      );

      await updateToolGenerationJob(job.id, {
        status: 'processing',
        metadata: {
          source_mode: sourceMode,
          category,
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
        source_mode: sourceMode,
        category,
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
