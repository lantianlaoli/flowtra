/**
 * Emergency fix script for stuck segment 1 frame generation
 * Project ID: bb504f30-57d2-4cbd-9522-9043dc5127f9
 *
 * This script manually triggers the frame generation for segment 1
 * that got stuck due to the last_processed_at bug in the webhook.
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../lib/supabase';
import { createSmartSegmentFrame, type SegmentPrompt } from '../lib/competitor-ugc-replication-workflow';

const PROJECT_ID = 'bb504f30-57d2-4cbd-9522-9043dc5127f9';
const SEGMENT_INDEX = 1;

async function fixStuckSegment() {
  const supabase = getSupabaseAdmin();

  console.log(`[Fix Script] Starting fix for project ${PROJECT_ID}, segment ${SEGMENT_INDEX}`);

  // 1. Get project data
  const { data: project, error: projectError } = await supabase
    .from('competitor_ugc_replication_projects')
    .select('*')
    .eq('id', PROJECT_ID)
    .single();

  if (projectError || !project) {
    console.error('[Fix Script] Failed to fetch project:', projectError);
    return;
  }

  // 2. Get segment data
  const { data: segment, error: segmentError } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('*')
    .eq('project_id', PROJECT_ID)
    .eq('segment_index', SEGMENT_INDEX)
    .single();

  if (segmentError || !segment) {
    console.error('[Fix Script] Failed to fetch segment:', segmentError);
    return;
  }

  if (segment.status !== 'awaiting_prev_first_frame') {
    console.log(`[Fix Script] Segment ${SEGMENT_INDEX} is not stuck (status: ${segment.status}), aborting`);
    return;
  }

  // 3. Get previous segment's first frame URL (for continuation)
  const { data: prevSegment, error: prevSegmentError } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('first_frame_url')
    .eq('project_id', PROJECT_ID)
    .eq('segment_index', SEGMENT_INDEX - 1)
    .single();

  if (prevSegmentError || !prevSegment || !prevSegment.first_frame_url) {
    console.error('[Fix Script] Failed to fetch previous segment first frame:', prevSegmentError);
    return;
  }

  console.log('[Fix Script] Previous segment first frame:', prevSegment.first_frame_url);

  // 4. Get brand data (if applicable)
  let brandLogoUrl: string | null = null;
  let productImageUrls: string[] | null = null;

  if (project.selected_brand_id) {
    const { data: brand } = await supabase
      .from('user_brands')
      .select('brand_logo_url')
      .eq('id', project.selected_brand_id)
      .single();

    brandLogoUrl = brand?.brand_logo_url || null;

    // Get product images (if any)
    const { data: products } = await supabase
      .from('user_products')
      .select('user_product_photos(photo_url)')
      .eq('brand_id', project.selected_brand_id)
      .limit(3);

    if (products && products.length > 0) {
      productImageUrls = products
        .flatMap(p => (p as any).user_product_photos || [])
        .map((photo: any) => photo.photo_url)
        .filter(Boolean);
    }
  }

  console.log('[Fix Script] Brand logo URL:', brandLogoUrl);
  console.log('[Fix Script] Product image URLs:', productImageUrls);

  // 5. Mark segment as generating
  await supabase
    .from('competitor_ugc_replication_segments')
    .update({ status: 'generating_first_frame' })
    .eq('id', segment.id);

  console.log('[Fix Script] Marked segment as generating_first_frame');

  // 6. Trigger frame generation
  try {
    const segmentPrompt = segment.prompt as SegmentPrompt;
    const aspectRatio = (project.video_aspect_ratio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16';
    const competitorFileType = project.competitor_file_type as 'video' | null;

    const taskId = await createSmartSegmentFrame(
      segmentPrompt,
      SEGMENT_INDEX,
      'first',
      aspectRatio,
      brandLogoUrl,
      productImageUrls,
      undefined, // brandContext
      competitorFileType,
      undefined, // overrides
      prevSegment.first_frame_url // continuation reference
    );

    console.log('[Fix Script] Frame generation triggered, task ID:', taskId);

    // 7. Save task ID
    await supabase
      .from('competitor_ugc_replication_segments')
      .update({ first_frame_task_id: taskId })
      .eq('id', segment.id);

    console.log('[Fix Script] ✅ Successfully triggered frame generation for segment 1');
    console.log('[Fix Script] Task ID saved to database');
    console.log('[Fix Script] Now waiting for webhook callback...');

  } catch (error) {
    console.error('[Fix Script] ❌ Failed to trigger frame generation:', error);

    // Mark segment as failed
    await supabase
      .from('competitor_ugc_replication_segments')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Manual fix failed'
      })
      .eq('id', segment.id);
  }
}

// Run the fix
fixStuckSegment()
  .then(() => {
    console.log('[Fix Script] Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Fix Script] Script failed:', error);
    process.exit(1);
  });
