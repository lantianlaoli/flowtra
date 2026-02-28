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
  resolveCloneModeFromProject,
  type SegmentPrompt,
  type SerializedSegmentPlanSegment
} from '@/lib/competitor-ugc-replication-workflow';
import { getGenerationCost, getReplicaPhotoCredits, getSegmentDurationForModel, type VideoModel } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import { getKlingPromptValidationResponse } from '@/lib/kling-prompt-api-error';

type PatchPayload = {
  prompt?: Partial<SegmentPrompt>;
  regenerate?: 'photo' | 'video' | 'both' | 'none';
  productIds?: string[];
  characterIds?: string[];
};

const PRODUCT_REFERENCE_LIMIT = 10;
const MENTION_REGEX = /@(?<type>character|product)\((?<name>[^)]*)\)/g;

function collectMentionNames(texts: Array<string | undefined | null>) {
  const characterNames = new Set<string>();
  const productNames = new Set<string>();

  texts.forEach((text) => {
    if (!text) return;
    for (const match of text.matchAll(MENTION_REGEX)) {
      const type = match.groups?.type;
      const name = (match.groups?.name || '').trim().toLowerCase();
      if (!name) continue;
      if (type === 'character') characterNames.add(name);
      if (type === 'product') productNames.add(name);
    }
  });

  return {
    characterNames: Array.from(characterNames),
    productNames: Array.from(productNames)
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; segmentIndex: string }> }) {
  let projectUserId: string | null = null;
  let projectId: string | null = null;
  const creditCharges: Array<{ amount: number; description: string }> = [];

  try {
    const isInternalRequest = request.headers.get('x-project-agent-internal') === '1';
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const { userId: clerkUserId } = isInternalRequest ? { userId: null } : await auth();
    const userId = internalUserId || clerkUserId;
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
    let requestedProductIds = Array.isArray(payload.productIds)
      ? Array.from(
          new Set(
            payload.productIds
              .map(id => (typeof id === 'string' ? id.trim() : ''))
              .filter(id => id.length > 0)
          )
        ).slice(0, PRODUCT_REFERENCE_LIMIT)
      : [];
    let requestedCharacterIds = Array.isArray(payload.characterIds)
      ? Array.from(
          new Set(
            payload.characterIds
              .map(id => (typeof id === 'string' ? id.trim() : ''))
              .filter(id => id.length > 0)
          )
        ).slice(0, PRODUCT_REFERENCE_LIMIT)
      : [];

    console.log('[SEGMENT API] Payload parsed:', { regenerate, shouldRegeneratePhoto, shouldRegenerateVideo, characterIds: requestedCharacterIds });

    const supabase = getSupabaseAdmin();
    console.log('[SEGMENT API] Querying project:', projectId);

    const { data: project, error: projectError } = await supabase
      .from('competitor_ugc_replication_projects')
      .select(
        'id,user_id,credits_cost,status,created_at,updated_at,is_segmented,segment_count,segment_duration_seconds,video_model,video_aspect_ratio,video_quality,video_duration,language,video_prompts,segment_plan,segment_status,merged_video_url,selected_brand_id,competitor_ad_id,selected_inputs'
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

    if (!isInternalRequest && project.user_id !== userId) {
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
      segmentDurationSeconds
    );
    const mergedPrompt = {
      ...existingPrompt,
      ...(payload.prompt || {})
    } as SegmentPrompt;
    const cloneMode = resolveCloneModeFromProject(project as Record<string, unknown>);
    const defaultFrameImageSize = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
    const previousFrameSize = typeof existingPrompt.first_frame_image_size === 'string'
      ? existingPrompt.first_frame_image_size
      : undefined;
    if (!mergedPrompt.first_frame_image_size) {
      mergedPrompt.first_frame_image_size = previousFrameSize || defaultFrameImageSize;
    }

    // Fallback mention resolution on server-side:
    // If frontend didn't provide productIds/characterIds, parse @mentions directly from prompt.
    if (shouldRegeneratePhoto && (requestedProductIds.length === 0 || requestedCharacterIds.length === 0)) {
      const mentionSources: string[] = [
        mergedPrompt.first_frame_description || '',
        ...(Array.isArray(mergedPrompt.shots)
          ? mergedPrompt.shots.flatMap((shot) => [
              shot?.subject || '',
              shot?.action || ''
            ])
          : [])
      ];
      const { productNames, characterNames } = collectMentionNames(mentionSources);

      if (requestedProductIds.length === 0 && productNames.length > 0) {
        const { data: productsByUser } = await supabase
          .from('user_products')
          .select('id,product_name')
          .eq('user_id', project.user_id);

        if (productsByUser?.length) {
          const matchedProductIds = productsByUser
            .filter(product => productNames.includes((product.product_name || '').trim().toLowerCase()))
            .map(product => product.id);
          requestedProductIds = Array.from(new Set(matchedProductIds)).slice(0, PRODUCT_REFERENCE_LIMIT);
        }
      }

      if (requestedCharacterIds.length === 0 && characterNames.length > 0) {
        const matchedSystemCharacterIds = SYSTEM_AVATARS
          .filter(avatar => characterNames.includes((avatar.avatar_name || '').trim().toLowerCase()))
          .map(avatar => avatar.id);

        const { data: avatarsByUser } = await supabase
          .from('user_avatars')
          .select('id,avatar_name')
          .eq('user_id', project.user_id);

        if (avatarsByUser?.length) {
          const matchedCharacterIds = avatarsByUser
            .filter(avatar => characterNames.includes((avatar.avatar_name || '').trim().toLowerCase()))
            .map(avatar => avatar.id);
          requestedCharacterIds = Array.from(new Set([
            ...matchedSystemCharacterIds,
            ...matchedCharacterIds
          ])).slice(0, PRODUCT_REFERENCE_LIMIT);
        } else if (matchedSystemCharacterIds.length > 0) {
          requestedCharacterIds = Array.from(new Set(matchedSystemCharacterIds)).slice(0, PRODUCT_REFERENCE_LIMIT);
        }
      }

      console.log('[SEGMENT API] Mention fallback resolved IDs:', {
        productNames,
        characterNames,
        requestedProductIds,
        requestedCharacterIds
      });
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

    // Schema verified via Supabase MCP (2026-01-29): competitor_ugc_replication_segments includes prompt, updated_at.
    const now = new Date().toISOString();
    const segmentUpdates: Record<string, unknown> = {
      prompt: serializeSegmentPrompt(mergedPrompt),
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
    const characterPhotoUrls: string[] = [];
    let brandContext: { brand_name: string } | undefined;

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
      // Brand step has been removed from clone flow; keep brand references disabled.
      brandLogoUrl = null;
      brandContext = undefined;

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

      if (requestedCharacterIds.length > 0) {
        console.log('[SEGMENT API] Fetching character photos:', { requestedCharacterIds });
        const systemAvatarMap = new Map(SYSTEM_AVATARS.map(avatar => [avatar.id, avatar.photo_url]));
        const userCharacterIds = requestedCharacterIds.filter(id => !systemAvatarMap.has(id));

        requestedCharacterIds.forEach((charId) => {
          const systemPhotoUrl = systemAvatarMap.get(charId);
          if (systemPhotoUrl && !characterPhotoUrls.includes(systemPhotoUrl)) {
            characterPhotoUrls.push(systemPhotoUrl);
          }
        });

        if (userCharacterIds.length === 0) {
          console.log('[SEGMENT API] All character IDs resolved from system avatars');
        }

        if (userCharacterIds.length > 0) {
          const { data: characters, error: characterError } = await supabase
            .from('user_avatars')
            .select('id, photo_url')
            .in('id', userCharacterIds)
            .eq('user_id', project.user_id);

          if (characterError) {
            console.error('[SEGMENT API] Failed to fetch characters:', characterError);
          }

          if (characters && characters.length > 0) {
            console.log('[SEGMENT API] Characters fetched:', characters);
            const charMap = new Map(characters.map(c => [c.id, c.photo_url]));
            requestedCharacterIds.forEach(charId => {
              const photoUrl = charMap.get(charId);
              if (photoUrl && typeof photoUrl === 'string' && photoUrl.length > 0) {
                characterPhotoUrls.push(photoUrl);
              }
            });
          } else {
            console.warn('[SEGMENT API] No user characters found in database for requested IDs');
          }
        }
        console.log('[SEGMENT API] Character photo URLs extracted:', characterPhotoUrls);
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
      // Version 2.0: Image generation is always free with Nano Banana 2.
      // No credits deducted for first frame regeneration

      const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
      const frameImageSize = mergedPrompt.first_frame_image_size || aspectRatio;

      console.log('[SEGMENT API] Calling createSmartSegmentFrame with:', {
        segmentIndex: index,
        frameType: 'first',
        isCloneMode: cloneMode.isCloneMode,
        referenceSourceType: cloneMode.sourceType,
        brandLogoUrl: brandLogoUrl ? 'present' : 'null',
        productImageUrlsCount: productImageUrls.length,
        characterPhotoUrlsCount: characterPhotoUrls.length,
        characterPhotoUrls,
        usesContinuationReference: Boolean(continuationReferenceUrl),
        imageInputCount: productImageUrls.length + characterPhotoUrls.length + (continuationReferenceUrl ? 1 : 0)
      });

      const firstFrameTaskId = await createSmartSegmentFrame(
        mergedPrompt,
        index,
        'first',
        aspectRatio,
        brandLogoUrl,
        productImageUrls.length ? productImageUrls : null,
        brandContext,
        cloneMode.mediaType,
        {
          aspectRatioOverride: frameImageSize,
          resolutionOverride: '1K',
          characterPhotoUrls: characterPhotoUrls.length > 0 ? characterPhotoUrls : null,
          usePromptAsIs: true
        },
        continuationReferenceUrl,
        projectModel || undefined
      );

      segmentUpdates.first_frame_task_id = firstFrameTaskId;
      segmentUpdates.first_frame_url = null;
      segmentUpdates.status = 'generating_first_frame';
      segmentUpdates.error_message = null;
      // CRITICAL: Clear webhook timestamp to allow new webhook to process
      segmentUpdates.first_frame_webhook_received_at = null;

      // NOTE: Closing frame generation has been REMOVED during regeneration
      // Reason: Closing frames are unnecessary and waste generation resources
      // Video generation uses only the first frame, closing frame is redundant
    }

    if (shouldRegenerateVideo) {
      segmentUpdates.video_url = null;
      segmentUpdates.video_task_id = null;
      segmentUpdates.retry_count = 0;
      segmentUpdates.error_message = null;
      // CRITICAL: Clear webhook timestamp to allow new webhook to process
      segmentUpdates.video_webhook_received_at = null;

      // Regenerating videos from the segment editor is free (no credit deduction).

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

    const projectUpdates: Record<string, unknown> = {
      segment_status: segmentStatus,
      last_processed_at: now
    };

    if (shouldRegenerateVideo) {
      projectUpdates.status = 'processing';
      projectUpdates.current_step = 'generating_segment_videos';
      projectUpdates.progress_percentage = 70;
    } else if (shouldRegeneratePhoto) {
      projectUpdates.status = 'processing';
      projectUpdates.current_step = 'generating_segment_frames';
      projectUpdates.progress_percentage = 35;
    }

    await supabase
      .from('competitor_ugc_replication_projects')
      .update(projectUpdates)
      .eq('id', projectId);

    const updatedSegment = (allSegments as CompetitorUgcReplicationSegment[]).find(seg => seg.segment_index === index);

    // NOTE: Do NOT clear creditCharges here! If KIE API fails asynchronously (in monitor-tasks),
    // we need to be able to refund. However, this means we cannot track success/failure at this point.
    // The proper solution would be to deduct credits AFTER KIE confirms success, not before.
    // For now, we rely on monitor-tasks to handle failures and manual refunds if needed.
    console.log('[SEGMENT API] Request completed successfully, credits deducted:', creditCharges);

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
    const klingResponse = getKlingPromptValidationResponse(error);
    if (klingResponse) {
      return NextResponse.json(
        { error: klingResponse.error },
        { status: klingResponse.status }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update segment' },
      { status: 500 }
    );
  }
}
