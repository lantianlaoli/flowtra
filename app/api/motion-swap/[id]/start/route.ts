import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createMotionSwapPreviewTask, createMotionSwapVideoTask, buildMotionSwapPreviewPrompt, buildMotionSwapVideoPrompt, MOTION_SWAP_MODE } from '@/lib/motion-swap-workflow';
import { checkCredits, deductCredits, recordCreditTransaction, refundCredits } from '@/lib/credits';
import { fetchTikTokVideoUrl } from '@/lib/fetch-tiktok-video';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CREDIT_RATE_PER_SECOND = 9;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const coverUrlOverride = typeof body?.cover_url === 'string' ? body.cover_url : null;
    const referenceVideoId = typeof body?.reference_video_id === 'string' ? body.reference_video_id : null;
    const avatarId = typeof body?.avatar_id === 'string' ? body.avatar_id : null;
    const productId = typeof body?.product_id === 'string' ? body.product_id : null;
    const photoPrompt = typeof body?.photo_prompt === 'string' ? body.photo_prompt : null;
    const videoPrompt = typeof body?.video_prompt === 'string' ? body.video_prompt : null;
    const action = body?.action === 'video' ? 'video' : 'image';
    const autoGenerateVideo = action === 'video';

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): motion_swap_projects
    const { data: project, error: projectError } = await supabase
      .from('motion_swap_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Allow editing from 'pending' or 'preview_ready' status
    if (project.status !== 'pending' && project.status !== 'preview_ready') {
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
    if (hasAvatar && resolvedAvatarId) {
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
    }

    let product: { id: string; product_name: string } | null = null;
    let productPhoto: { id: string; photo_url: string; is_primary: boolean } | null = null;
    if (hasProduct && resolvedProductId) {
      // Schema verified via Supabase MCP (2026-02-01): user_products, user_product_photos
      const { data: productData, error: productError } = await supabase
        .from('user_products')
        .select('id, product_name')
        .eq('id', resolvedProductId)
        .eq('user_id', userId)
        .single();

      if (productError || !productData) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      product = productData;

      const { data: productPhotos, error: photoError } = await supabase
        .from('user_product_photos')
        .select('id, photo_url, is_primary')
        .eq('product_id', product.id)
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (photoError || !productPhotos || productPhotos.length === 0) {
        return NextResponse.json({ error: 'Product photo not found' }, { status: 404 });
      }

      productPhoto = productPhotos[0];
    }
    const durationSeconds = referenceVideo.duration_seconds;

    if (!durationSeconds || durationSeconds <= 0) {
      return NextResponse.json({ error: 'Reference video duration is missing' }, { status: 400 });
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

    const coverUrl = coverUrlOverride || project.reference_cover_url || referenceVideo.cover_url;
    if (!coverUrl) {
      return NextResponse.json({ error: 'Cover image is missing' }, { status: 400 });
    }

    const creditsCost = durationSeconds * CREDIT_RATE_PER_SECOND;
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

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL is not configured' }, { status: 500 });
    }

    // Special case: If project is in preview_ready status and action is 'video',
    // skip preview generation and go directly to video generation
    if (project.status === 'preview_ready' && action === 'video') {
      try {
        if (!project.preview_image_url) {
          return NextResponse.json({ error: 'Preview image is missing' }, { status: 400 });
        }

        const callbackUrl = new URL('/api/motion-swap/webhooks/video', baseUrl).toString();
        const videoTaskId = await createMotionSwapVideoTask({
          previewImageUrl: project.preview_image_url,
          referenceVideoUrl: videoCdnUrl,
          mode: MOTION_SWAP_MODE,
          prompt: videoPrompt || buildMotionSwapVideoPrompt({ hasAvatar, hasProduct })
        }, callbackUrl);

        const { data: updatedProject, error: updateError } = await supabase
          .from('motion_swap_projects')
          .update({
            video_task_id: videoTaskId,
            video_prompt: videoPrompt || buildMotionSwapVideoPrompt({ hasAvatar, hasProduct }),
            auto_generate_video: true,
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
        console.error('[Motion Swap Start] Video task error:', error);
        await supabase
          .from('motion_swap_projects')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Failed to start video task',
            progress_percentage: 0
          })
          .eq('id', project.id);

        return NextResponse.json({ error: 'Failed to start video task' }, { status: 500 });
      }
    }

    // Normal flow: Generate preview (and optionally video based on auto_generate_video)
    let creditsDeducted = false;
    try {
      const deduction = await deductCredits(userId, creditsCost);
      if (!deduction.success) {
        return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
      }
      creditsDeducted = true;

      await recordCreditTransaction(
        userId,
        'usage',
        creditsCost,
        `Motion Swap generation (${durationSeconds}s @ 1080p)`,
        project.id,
        true
      );

      const callbackUrl = new URL('/api/motion-swap/webhooks/preview', baseUrl).toString();
      const previewTaskId = await createMotionSwapPreviewTask({
        coverUrl,
        avatarUrl: avatar?.photo_url || null,
        productUrl: productPhoto?.photo_url || null,
        aspectRatio: '9:16',
        prompt: photoPrompt || buildMotionSwapPreviewPrompt({ hasAvatar, hasProduct })
      }, callbackUrl);

      const { data: updatedProject, error: updateError } = await supabase
        .from('motion_swap_projects')
        .update({
          creator_source_id: referenceVideo.source_id,
          creator_source_video_id: referenceVideo.id,
          avatar_id: avatar?.id || null,
          product_id: product?.id || null,
          product_photo_id: productPhoto?.id || null,
          reference_video_url: referenceVideo.video_url,
          reference_video_cdn_url: videoCdnUrl,
          reference_cover_url: coverUrl,
          reference_duration_seconds: durationSeconds,
          photo_prompt: photoPrompt || null,
          video_prompt: videoPrompt || buildMotionSwapVideoPrompt({ hasAvatar, hasProduct }),
          credits_cost: creditsCost,
          generation_credits_used: creditsCost,
          preview_task_id: previewTaskId,
          auto_generate_video: autoGenerateVideo,
          status: 'generating_preview',
          progress_percentage: 40,
          mode: MOTION_SWAP_MODE
        })
        .eq('id', project.id)
        .select('*')
        .single();

      if (updateError || !updatedProject) {
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
      }

      return NextResponse.json({ project: updatedProject });
    } catch (error) {
      console.error('[Motion Swap Start] Preview task error:', error);
      await supabase
        .from('motion_swap_projects')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Failed to start preview task',
          progress_percentage: 0
        })
        .eq('id', project.id);

      if (creditsDeducted && creditsCost > 0) {
        await refundCredits(userId, creditsCost, 'Motion Swap preview task failed', project.id);
      }

      return NextResponse.json({ error: 'Failed to start preview task' }, { status: 500 });
    }
  } catch (error) {
    console.error('[Motion Swap Start] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
