import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createMotionClonePreviewTask, createMotionCloneVideoTask } from '@/lib/motion-clone-workflow';
import { buildMotionClonePreviewPrompt, buildMotionCloneVideoPrompt } from '@/lib/motion-clone-prompts';
import { checkCredits, deductCredits, recordCreditTransaction, refundCredits } from '@/lib/credits';
import { fetchTikTokVideoUrl } from '@/lib/fetch-tiktok-video';
import { getMotionCloneGenerationCost, normalizeMotionCloneQuality } from '@/lib/constants';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import {
  buildKlingElementsFromMentions,
  collectKlingMentions,
  replacePromptMentionsWithKlingElements,
} from '@/lib/kling-elements';
import { replaceMentionsForPlainText } from '@/lib/video-clone-prompt-compiler';
import { verifyInternalUserRequest } from '@/lib/security/internal-request';
import { validateKieCredits } from '@/lib/kie-credits-check';
import { resolveProductForUser } from '@/lib/product-resolution';
import { moderatePromptBeforeGeneration, isCreemModerationError } from '@/lib/creem-moderation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const EDITABLE_MOTION_CLONE_STATUSES = new Set([
  'pending',
  'preview_ready',
  'completed',
  'failed',
]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const internalTimestamp = request.headers.get('x-project-agent-timestamp');
    const internalSignature = request.headers.get('x-project-agent-signature');
    const hasValidInternalSignature = verifyInternalUserRequest({
      userId: internalUserId,
      timestamp: internalTimestamp,
      signature: internalSignature,
    });

    const { userId } = hasValidInternalSignature
      ? { userId: internalUserId }
      : await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const referenceVideoId = typeof body?.reference_video_id === 'string' ? body.reference_video_id : null;
    const avatarId = typeof body?.avatar_id === 'string' ? body.avatar_id : null;
    const productId = typeof body?.product_id === 'string' ? body.product_id : null;
    const photoPrompt = typeof body?.photo_prompt === 'string' ? body.photo_prompt : null;
    const videoPrompt = typeof body?.video_prompt === 'string' ? body.video_prompt : null;
    const action = body?.action === 'video' ? 'video' : 'image';
    const autoGenerateVideo = action === 'video';

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-03-12): motion_clone_projects
    // Columns used below are confirmed to exist:
    // preview_task_id, preview_image_url, preview_webhook_received_at,
    // video_task_id, output_video_url, video_webhook_received_at,
    // status, progress_percentage, credits_cost, generation_credits_used,
    // mode, error_message, auto_generate_video
    const { data: project, error: projectError } = await supabase
      .from('motion_clone_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const selectedQuality = normalizeMotionCloneQuality(
      typeof body?.mode === 'string' ? body.mode : project.mode
    );

    // Allow regenerating from idle states, but never while a task is already running.
    if (!EDITABLE_MOTION_CLONE_STATUSES.has(project.status)) {
      return NextResponse.json({ error: 'Project is not ready for editing' }, { status: 409 });
    }

    const resolvedReferenceVideoId = referenceVideoId || project.creator_source_video_id;
    const hasAvatar = Boolean(avatarId);
    const hasProduct = Boolean(productId);
    const resolvedAvatarId = hasAvatar ? avatarId : null;
    const resolvedProductId = hasProduct ? productId : null;

    if (!resolvedReferenceVideoId) {
      return NextResponse.json({ error: 'Reference video is missing' }, { status: 400 });
    }

    if (!hasAvatar && !hasProduct) {
      return NextResponse.json({ error: 'Swap targets are missing' }, { status: 400 });
    }

    const resolvedVideoPrompt = videoPrompt || project.video_prompt || '';
    const videoMentions = collectKlingMentions([resolvedVideoPrompt]);
    const { elements, tokenMap, plainTokenMap } = await buildKlingElementsFromMentions(userId, videoMentions);
    const compiledPhotoPrompt = photoPrompt
      ? replaceMentionsForPlainText(photoPrompt)
      : null;
    const compiledVideoPrompt = resolvedVideoPrompt
      ? replacePromptMentionsWithKlingElements(resolvedVideoPrompt, tokenMap, plainTokenMap)
      : null;

    // Schema verified via Supabase MCP (2026-02-01): creator_source_videos
    const { data: referenceVideo, error: referenceError } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('id', resolvedReferenceVideoId)
      .eq('user_id', userId)
      .single();

    if (referenceError || !referenceVideo) {
      return NextResponse.json({ error: 'Reference video not found' }, { status: 404 });
    }

    let avatar: { id: string; photo_url: string } | null = null;
    let persistableAvatarId: string | null = null;
    if (hasAvatar && resolvedAvatarId) {
      const systemAvatar = SYSTEM_AVATARS.find((item) => item.id === resolvedAvatarId);
      if (systemAvatar) {
        avatar = {
          id: systemAvatar.id,
          photo_url: systemAvatar.photo_url,
        };
      } else {
      // Schema verified via Supabase MCP (2026-02-01): user_avatars
        const { data: avatarData, error: avatarError } = await supabase
          .from('user_avatars')
          .select('id, photo_url')
          .eq('id', resolvedAvatarId)
          .eq('user_id', userId)
          .single();

        if (avatarError || !avatarData) {
          return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
        }
        avatar = avatarData;
        persistableAvatarId = avatarData.id;
      }
    }

    let product: { id: string; product_name: string } | null = null;
    let productPhoto: { id: string; photo_url: string; is_primary: boolean } | null = null;
    let persistableProductId: string | null = null;
    let persistableProductPhotoId: string | null = null;
    if (hasProduct && resolvedProductId) {
      const resolvedProduct = await resolveProductForUser({
        supabase,
        userId,
        productId: resolvedProductId,
        maxPhotos: 1
      });

      if (!resolvedProduct.found) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      if (resolvedProduct.photoUrls.length === 0 || !resolvedProduct.frontalPhotoUrl) {
        return NextResponse.json({ error: 'Product photo not found' }, { status: 404 });
      }

      product = {
        id: resolvedProductId,
        product_name: resolvedProduct.productName || 'Product',
      };
      persistableProductId = resolvedProduct.persistableProductId;
      persistableProductPhotoId = resolvedProduct.frontalPhotoId;
      productPhoto = {
        id: resolvedProduct.frontalPhotoId || `${resolvedProductId}-frontal`,
        photo_url: resolvedProduct.frontalPhotoUrl,
        is_primary: true,
      };
    }
    const durationSeconds = referenceVideo.duration_seconds;

    if (!durationSeconds || durationSeconds <= 0) {
      return NextResponse.json({ error: 'Reference video duration is missing' }, { status: 400 });
    }

    if (durationSeconds < 3 || durationSeconds > 30) {
      return NextResponse.json(
        { error: `Reference video must be 3-30s. Current: ${Math.round(durationSeconds)}s.` },
        { status: 400 }
      );
    }

    let videoCdnUrl = referenceVideo.video_cdn_url as string | null;
    if (!videoCdnUrl) {
      if (!referenceVideo.video_url) {
        return NextResponse.json({ error: 'Reference video URL is missing' }, { status: 400 });
      }
      videoCdnUrl = await fetchTikTokVideoUrl(referenceVideo.video_url as string);
      await supabase
        .from('creator_source_videos')
        .update({ video_cdn_url: videoCdnUrl })
        .eq('id', referenceVideo.id);
    }

    if (!videoCdnUrl) {
      return NextResponse.json({ error: 'Failed to resolve reference video URL' }, { status: 400 });
    }

    const creditsCost = getMotionCloneGenerationCost(durationSeconds, selectedQuality);
    const shouldChargeForGeneration = action === 'video';
    const resetVideoGenerationState = {
      video_task_id: null,
      output_video_url: null,
      video_webhook_received_at: null,
      error_message: null,
    };
    const resetPreviewGenerationState = {
      preview_task_id: null,
      preview_image_url: null,
      preview_webhook_received_at: null,
      ...resetVideoGenerationState,
    };

    if (shouldChargeForGeneration) {
      const creditCheck = await checkCredits(userId, creditsCost);

      if (!creditCheck.success) {
        return NextResponse.json({ error: creditCheck.error || 'Failed to check credits' }, { status: 500 });
      }

      if (!creditCheck.hasEnoughCredits) {
        return NextResponse.json({
          error: 'Insufficient credits',
          required: creditsCost,
          remaining: creditCheck.currentCredits || 0
        }, { status: 402 });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL is not configured' }, { status: 500 });
    }
    const canReuseExistingPreview =
      action === 'video' &&
      typeof project.preview_image_url === 'string' &&
      project.preview_image_url.length > 0;

    // Reuse an existing preview whenever the user is only regenerating video.
    if (canReuseExistingPreview) {
      // Moderate video prompt before any billing or model invocation
      const videoPromptForModeration = compiledVideoPrompt || buildMotionCloneVideoPrompt({ hasAvatar, hasProduct });
      try {
        await moderatePromptBeforeGeneration(videoPromptForModeration, {
          externalId: `user_${userId}:motion_clone_${project.id}:video`,
        });
      } catch (moderationError) {
        if (isCreemModerationError(moderationError)) {
          return NextResponse.json({ error: moderationError.message }, { status: (moderationError as { status?: number }).status || 400 });
        }
        throw moderationError;
      }

      let creditsDeducted = false;
      try {
        if (!project.preview_image_url) {
          return NextResponse.json({ error: 'Preview image is missing' }, { status: 400 });
        }

        const deduction = await deductCredits(userId, creditsCost);
        if (!deduction.success) {
          return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
        }
        creditsDeducted = true;

        await recordCreditTransaction(
          userId,
          'usage',
          creditsCost,
          `Motion Clone generation (${durationSeconds}s @ ${selectedQuality})`,
          project.id,
          true
        );

        const callbackUrl = new URL('/api/motion-clone/webhooks/video', baseUrl).toString();
        const videoTaskId = await createMotionCloneVideoTask({
          previewImageUrl: project.preview_image_url,
          referenceVideoUrl: videoCdnUrl,
          mode: selectedQuality,
          prompt: compiledVideoPrompt || buildMotionCloneVideoPrompt({ hasAvatar, hasProduct }),
          elements: elements.length > 0 ? elements : undefined,
          moderationExternalId: `user_${userId}:motion_clone_${project.id}:video`,
        }, callbackUrl);

        const { data: updatedProject, error: updateError } = await supabase
          .from('motion_clone_projects')
          .update({
            ...resetVideoGenerationState,
            video_task_id: videoTaskId,
            photo_prompt: photoPrompt || project.photo_prompt || null,
            video_prompt: videoPrompt || buildMotionCloneVideoPrompt({ hasAvatar, hasProduct }),
            avatar_id: persistableAvatarId,
            product_id: persistableProductId,
            product_photo_id: persistableProductPhotoId,
            auto_generate_video: true,
            credits_cost: creditsCost,
            generation_credits_used: creditsCost,
            mode: selectedQuality,
            status: 'generating_video',
            progress_percentage: 75
          })
          .eq('id', project.id)
          .select('*')
          .single();

        if (updateError || !updatedProject) {
          return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
        }

        return NextResponse.json({ project: updatedProject });
      } catch (error) {
        console.error('[Motion Clone Start] Video task error:', error);
        await supabase
          .from('motion_clone_projects')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Failed to start video task',
            progress_percentage: 0
          })
          .eq('id', project.id);

        if (creditsDeducted && creditsCost > 0) {
          await refundCredits(userId, creditsCost, 'Motion Clone video task failed', project.id);
        }

        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Failed to start video task'
        }, { status: 500 });
      }
    }

    // Normal flow: Generate preview (and optionally video based on auto_generate_video)
    // Moderate photo prompt before any billing or model invocation
    const photoPromptForModeration = compiledPhotoPrompt || photoPrompt || buildMotionClonePreviewPrompt({ hasAvatar, hasProduct });
    try {
      await moderatePromptBeforeGeneration(photoPromptForModeration, {
        externalId: `user_${userId}:motion_clone_${project.id}:preview`,
      });
    } catch (moderationError) {
      if (isCreemModerationError(moderationError)) {
        return NextResponse.json({ error: moderationError.message }, { status: (moderationError as { status?: number }).status || 400 });
      }
      throw moderationError;
    }

    let creditsDeducted = false;
    try {
      if (shouldChargeForGeneration) {
        const deduction = await deductCredits(userId, creditsCost);
        if (!deduction.success) {
          return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
        }
        creditsDeducted = true;

        await recordCreditTransaction(
          userId,
          'usage',
          creditsCost,
          `Motion Clone generation (${durationSeconds}s @ ${selectedQuality})`,
          project.id,
          true
        );
      }

      const callbackUrl = new URL('/api/motion-clone/webhooks/preview', baseUrl).toString();
      const previewTaskId = await createMotionClonePreviewTask({
        avatarUrl: avatar?.photo_url || null,
        productUrl: productPhoto?.photo_url || null,
        aspectRatio: '9:16',
        prompt: photoPromptForModeration,
        moderationExternalId: `user_${userId}:motion_clone_${project.id}:preview`,
      }, callbackUrl);

      const { data: updatedProject, error: updateError } = await supabase
        .from('motion_clone_projects')
        .update({
          ...resetPreviewGenerationState,
          creator_source_id: referenceVideo.source_id,
          creator_source_video_id: referenceVideo.id,
          avatar_id: persistableAvatarId,
          product_id: persistableProductId,
          product_photo_id: persistableProductPhotoId,
          reference_video_url: referenceVideo.video_url,
          reference_video_cdn_url: videoCdnUrl,
          reference_duration_seconds: durationSeconds,
          photo_prompt: photoPrompt || null,
          video_prompt: videoPrompt || buildMotionCloneVideoPrompt({ hasAvatar, hasProduct }),
          credits_cost: shouldChargeForGeneration ? creditsCost : 0,
          generation_credits_used: shouldChargeForGeneration ? creditsCost : 0,
          preview_task_id: previewTaskId,
          auto_generate_video: autoGenerateVideo,
          status: 'generating_preview',
          progress_percentage: 40,
          mode: selectedQuality
        })
        .eq('id', project.id)
        .select('*')
        .single();

      if (updateError || !updatedProject) {
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
      }

      return NextResponse.json({ project: updatedProject });
    } catch (error) {
      console.error('[Motion Clone Start] Preview task error:', error);
      await supabase
        .from('motion_clone_projects')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Failed to start preview task',
          progress_percentage: 0
        })
        .eq('id', project.id);

      if (creditsDeducted && creditsCost > 0) {
        await refundCredits(userId, creditsCost, 'Motion Clone preview task failed', project.id);
      }

      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Failed to start preview task'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Motion Clone Start] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
