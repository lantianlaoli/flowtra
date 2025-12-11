import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, type CompetitorUgcReplicationSegment, type SingleVideoProject } from '@/lib/supabase';
import {
  buildSegmentStatusPayload,
  createSmartSegmentFrame,
  startSegmentVideoTask,
  serializeSegmentPrompt,
  hydrateSerializedSegmentPrompt,
  type SegmentPrompt,
  type SerializedSegmentPlanSegment
} from '@/lib/competitor-ugc-replication-workflow';
import { getGenerationCost, getReplicaPhotoCredits, getSegmentDurationForModel, type VideoModel } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

type PatchPayload = {
  prompt?: Partial<SegmentPrompt>;
  regenerate?: 'photo' | 'video' | 'both' | 'none';
  productIds?: string[];
};

const PRODUCT_REFERENCE_LIMIT = 10;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; segmentIndex: string }> }) {
  let projectUserId: string | null = null;
  let projectId: string | null = null;
  const creditCharges: Array<{ amount: number; description: string }> = [];

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, segmentIndex } = await params;
    projectId = id;
    const index = Number(segmentIndex);

    console.log('[SEGMENT API] Request received:', { projectId, segmentIndex, index, userId });

    if (!projectId || Number.isNaN(index) || index < 0) {
      console.error('[SEGMENT API] Invalid parameters:', { projectId, segmentIndex, index });
      return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
    }

    const payload = (await request.json()) as PatchPayload;
    const regenerate = payload.regenerate || 'none';
    const shouldRegeneratePhoto = regenerate === 'photo' || regenerate === 'both';
    const shouldRegenerateVideo = regenerate === 'video' || regenerate === 'both';
    const requestedProductIds = Array.isArray(payload.productIds)
      ? Array.from(
          new Set(
            payload.productIds
              .map(id => (typeof id === 'string' ? id.trim() : ''))
              .filter(id => id.length > 0)
          )
        ).slice(0, PRODUCT_REFERENCE_LIMIT)
      : [];

    console.log('[SEGMENT API] Payload parsed:', { regenerate, shouldRegeneratePhoto, shouldRegenerateVideo });

    const supabase = getSupabaseAdmin();
    console.log('[SEGMENT API] Querying project:', projectId);

    const { data: project, error: projectError } = await supabase
      .from('competitor_ugc_replication_projects')
      .select(
        'id,user_id,credits_cost,status,created_at,updated_at,is_segmented,segment_count,segment_duration_seconds,video_model,video_aspect_ratio,video_quality,video_duration,language,video_prompts,segment_plan,segment_status,merged_video_url,selected_brand_id,competitor_ad_id'
      )
      .eq('id', projectId)
      .single();

    console.log('[SEGMENT API] Project query result:', {
      found: !!project,
      error: projectError,
      projectUserId: project?.user_id,
      currentUserId: userId
    });

    if (projectError || !project) {
      console.error('[SEGMENT API] Project not found:', { projectId, error: projectError });
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    projectUserId = project.user_id;

    if (!project.is_segmented) {
      return NextResponse.json({ error: 'Segment editing is only available for segmented projects' }, { status: 400 });
    }

    const { data: segmentRow, error: segmentError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('*')
      .eq('project_id', projectId)
      .eq('segment_index', index)
      .single();

    if (segmentError || !segmentRow) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const projectModel = (project.video_model ?? null) as VideoModel | null;
    const segmentDurationSeconds = project.segment_duration_seconds || getSegmentDurationForModel(projectModel);
    const existingPrompt = hydrateSerializedSegmentPrompt(
      segmentRow.prompt as SerializedSegmentPlanSegment,
      index,
      segmentDurationSeconds,
      segmentRow.contains_brand,
      segmentRow.contains_product
    );
    const mergedPrompt = {
      ...existingPrompt,
      ...(payload.prompt || {})
    } as SegmentPrompt;
    mergedPrompt.contains_brand = existingPrompt.contains_brand;
    mergedPrompt.contains_product = existingPrompt.contains_product;
    const defaultFrameImageSize = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
    const previousFrameSize = typeof existingPrompt.first_frame_image_size === 'string'
      ? existingPrompt.first_frame_image_size
      : undefined;
    if (!mergedPrompt.first_frame_image_size) {
      mergedPrompt.first_frame_image_size = previousFrameSize || defaultFrameImageSize;
    }

    if (shouldRegeneratePhoto && segmentRow.status === 'generating_first_frame') {
      return NextResponse.json(
        { error: 'First frame regeneration already in progress. Please wait until it completes.' },
        { status: 409 }
      );
    }

    if (shouldRegenerateVideo) {
      // Only block if ACTIVELY generating (not failed)
      const isActivelyGenerating = segmentRow.status === 'generating_video';

      if (isActivelyGenerating) {
        return NextResponse.json(
          { error: 'Video regeneration already running. Please wait until the current job finishes.' },
          { status: 409 }
        );
      }

      // Allow retry even if video_task_id exists (might be from failed attempt)
      // The cleanup at lines 322-325 will clear task_id and reset retry_count to 0
    }

    const now = new Date().toISOString();
    const segmentUpdates: Record<string, unknown> = {
      prompt: serializeSegmentPrompt(mergedPrompt),
      contains_brand: mergedPrompt.contains_brand === true,
      contains_product: mergedPrompt.contains_product === true,
      updated_at: now
    };

    let brandLogoUrl: string | null = null;
    const productImageUrls: string[] = [];
    const addProductPhotoUrl = (url?: string | null) => {
      if (!url || productImageUrls.length >= PRODUCT_REFERENCE_LIMIT) {
        return;
      }
      if (!productImageUrls.includes(url)) {
        productImageUrls.push(url);
      }
    };
    let brandContext: { brand_name: string; brand_slogan: string; brand_details: string } | undefined;
    let competitorFileType: 'video' | 'image' | null = null;

    const ensureCredits = async (amount: number, description: string) => {
      if (!projectUserId || amount <= 0) return;

      const creditCheck = await checkCredits(projectUserId, amount);
      if (!creditCheck.success) {
        throw new Error(creditCheck.error || 'Failed to check credits');
      }
      if (!creditCheck.hasEnoughCredits) {
        throw new Error(`Insufficient credits: need ${amount}, have ${creditCheck.currentCredits || 0}`);
      }

      const deductResult = await deductCredits(projectUserId, amount);
      if (!deductResult.success) {
        throw new Error(deductResult.error || 'Failed to deduct credits');
      }

      await recordCreditTransaction(
        projectUserId,
        'usage',
        amount,
        description,
        project.id,
        true
      );

      creditCharges.push({ amount, description });
    };

    const ensureBrandAndProductAssets = async () => {
      if (project.selected_brand_id) {
        const { data: brand } = await supabase
          .from('user_brands')
          .select('brand_name,brand_slogan,brand_details,brand_logo_url')
          .eq('id', project.selected_brand_id)
          .single();
        if (brand) {
          brandLogoUrl = brand.brand_logo_url || null;
          brandContext = {
            brand_name: brand.brand_name || '',
            brand_slogan: brand.brand_slogan || '',
            brand_details: brand.brand_details || ''
          };
        }
      }

      if (requestedProductIds.length > 0) {
        const { data: requestedProducts } = await supabase
          .from('user_products')
          .select('id,user_id,user_product_photos(photo_url,is_primary)')
          .in('id', requestedProductIds)
          .eq('user_id', project.user_id);

        if (requestedProducts?.length) {
          const map = new Map<string, { user_product_photos?: Array<{ photo_url: string; is_primary?: boolean }> }>();
          requestedProducts.forEach(product => {
            map.set(product.id, product);
          });

          requestedProductIds.forEach(productId => {
            const match = map.get(productId);
            if (!match?.user_product_photos?.length) return;
            const primary = match.user_product_photos.find(photo => photo.is_primary);
            const fallback = match.user_product_photos[0];
            addProductPhotoUrl(primary?.photo_url || fallback?.photo_url || null);
          });
        }
      }

      if (project.competitor_ad_id) {
        const { data: competitor } = await supabase
          .from('competitor_ads')
          .select('file_type')
          .eq('id', project.competitor_ad_id)
          .single();
        competitorFileType = competitor?.file_type as 'video' | 'image' | null;
      }
    };

    if (shouldRegeneratePhoto || shouldRegenerateVideo) {
      await ensureBrandAndProductAssets();
    }

    let continuationReferenceUrl: string | null = null;
    if (mergedPrompt.is_continuation_from_prev && index > 0) {
      const { data: prevSegment } = await supabase
        .from('competitor_ugc_replication_segments')
        .select('first_frame_url')
        .eq('project_id', projectId)
        .eq('segment_index', index - 1)
        .single();
      continuationReferenceUrl = prevSegment?.first_frame_url || null;
      if (!continuationReferenceUrl) {
        return NextResponse.json({
          error: 'Previous segment frame not ready',
          details: 'Wait for the previous segment to finish before regenerating this continuation segment.'
        }, { status: 409 });
      }
    }

    if (shouldRegeneratePhoto) {
      const photoCredits = getReplicaPhotoCredits();
      if (photoCredits > 0) {
        await ensureCredits(photoCredits, 'Competitor UGC Replication - Segment first frame regeneration');
      }

      const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
      const frameImageSize = mergedPrompt.first_frame_image_size || aspectRatio;
      const firstFrameTaskId = await createSmartSegmentFrame(
        mergedPrompt,
        index,
        'first',
        aspectRatio,
        brandLogoUrl,
        productImageUrls.length ? productImageUrls : null,
        brandContext,
        competitorFileType,
        {
          imageModelOverride: 'nano_banana_pro',
          imageSizeOverride: frameImageSize,
          resolutionOverride: '1K'
        },
        continuationReferenceUrl
      );

      segmentUpdates.first_frame_task_id = firstFrameTaskId;
      segmentUpdates.first_frame_url = null;
      segmentUpdates.status = 'generating_first_frame';
      segmentUpdates.error_message = null;

      const lastIndex = (project.segment_count || 0) - 1;
      if (index === lastIndex) {
        const closingTaskId = await createSmartSegmentFrame(
          mergedPrompt,
          index,
          'closing',
          aspectRatio,
          brandLogoUrl,
          productImageUrls.length ? productImageUrls : null,
          brandContext,
          competitorFileType,
          {
            imageModelOverride: 'nano_banana_pro',
            imageSizeOverride: frameImageSize,
            resolutionOverride: '1K'
          },
          null
        );
        segmentUpdates.closing_frame_task_id = closingTaskId;
        segmentUpdates.closing_frame_url = null;
      }
    }

    if (shouldRegenerateVideo) {
      segmentUpdates.video_url = null;
      segmentUpdates.video_task_id = null;
      segmentUpdates.retry_count = 0;
      segmentUpdates.error_message = null;

      const totalVideoCost = getGenerationCost(
        (project.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6',
        project.video_duration,
        project.video_quality || 'standard'
      );
      const segmentsCount = project.segment_count && project.segment_count > 0 ? project.segment_count : 1;
      const videoCredits = totalVideoCost > 0 ? Math.max(1, Math.ceil(totalVideoCost / segmentsCount)) : 0;
      if (videoCredits > 0) {
        const descriptor = project.video_model ? project.video_model.toUpperCase() : 'VIDEO';
        await ensureCredits(videoCredits, `Competitor UGC Replication - Segment video regeneration (${descriptor})`);
      }

      const hasFreshFirstFrame = shouldRegeneratePhoto ? false : Boolean(segmentRow.first_frame_url);

      if (!shouldRegeneratePhoto && !segmentRow.first_frame_url) {
        return NextResponse.json(
          { error: 'First frame missing. Please regenerate the first frame before regenerating the video.' },
          { status: 400 }
        );
      }

      if (!shouldRegeneratePhoto && hasFreshFirstFrame) {
        const videoTaskId = await startSegmentVideoTask(
          {
            ...(project as SingleVideoProject),
            video_prompts: project.video_prompts
          } as SingleVideoProject,
          mergedPrompt,
          segmentRow.first_frame_url as string,
          segmentRow.closing_frame_url,
          index,
          project.segment_count || 1
        );
        segmentUpdates.video_task_id = videoTaskId;
        segmentUpdates.status = 'generating_video';
      } else if (!shouldRegeneratePhoto) {
        segmentUpdates.status = 'first_frame_ready';
      }
    }

    const { error: updateError } = await supabase
      .from('competitor_ugc_replication_segments')
      .update(segmentUpdates)
      .eq('id', segmentRow.id);

    if (updateError) {
      console.error('Failed to update segment:', updateError);
      return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
    }

    const { data: allSegments, error: fetchSegmentsError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('*')
      .eq('project_id', projectId)
      .order('segment_index', { ascending: true });

    if (fetchSegmentsError || !allSegments) {
      return NextResponse.json({ error: 'Failed to refresh segment status' }, { status: 500 });
    }

    const segmentStatus = buildSegmentStatusPayload(allSegments as CompetitorUgcReplicationSegment[], project.merged_video_url || null);

    await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        segment_status: segmentStatus,
        last_processed_at: now
      })
      .eq('id', projectId);

    const updatedSegment = (allSegments as CompetitorUgcReplicationSegment[]).find(seg => seg.segment_index === index);
    creditCharges.length = 0;
    return NextResponse.json({
      success: true,
      segment: updatedSegment,
      segmentStatus
    });
  } catch (error) {
    if (projectUserId && creditCharges.length) {
      for (const charge of creditCharges) {
        try {
          await deductCredits(projectUserId, -charge.amount);
          await recordCreditTransaction(
            projectUserId,
            'refund',
            charge.amount,
            `${charge.description} refund`,
            projectId || undefined,
            true
          );
        } catch (refundError) {
          console.error('Failed to refund credits after segment error:', refundError);
        }
      }
    }

    console.error('Segment update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update segment' },
      { status: 500 }
    );
  }
}
