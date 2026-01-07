/**
 * Batch fix script for multiple stuck projects affected by last_processed_at bug
 * User: user_37t3Ly2J8jWWNUWS1RaTBvGtSaD
 * Projects:
 * - d266cd4d-935f-4ea8-ad23-aa524a3ffdbc (5 segments, stuck since 2026-01-06)
 * - f54b2df2-af09-4bc9-9c8c-aaa6cd3d4571 (2 segments, stuck since 2026-01-06)
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../lib/supabase';
import { createSmartSegmentFrame, type SegmentPrompt } from '../lib/competitor-ugc-replication-workflow';

const STUCK_PROJECTS = [
  {
    projectId: 'd266cd4d-935f-4ea8-ad23-aa524a3ffdbc',
    userId: 'user_37t3Ly2J8jWWNUWS1RaTBvGtSaD',
    segmentCount: 5
  },
  {
    projectId: 'f54b2df2-af09-4bc9-9c8c-aaa6cd3d4571',
    userId: 'user_37t3Ly2J8jWWNUWS1RaTBvGtSaD',
    segmentCount: 2
  }
];

async function fixStuckProject(projectId: string, segmentCount: number) {
  const supabase = getSupabaseAdmin();

  console.log(`\n========================================`);
  console.log(`[Batch Fix] Processing project ${projectId}`);
  console.log(`========================================\n`);

  // Get project data
  const { data: project, error: projectError } = await supabase
    .from('competitor_ugc_replication_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error(`[Batch Fix] ❌ Failed to fetch project:`, projectError);
    return { success: false, error: 'Project not found' };
  }

  // Get all segments
  const { data: segments, error: segmentsError } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('*')
    .eq('project_id', projectId)
    .order('segment_index', { ascending: true });

  if (segmentsError || !segments) {
    console.error(`[Batch Fix] ❌ Failed to fetch segments:`, segmentsError);
    return { success: false, error: 'Segments not found' };
  }

  console.log(`[Batch Fix] Found ${segments.length} segments`);

  // Find stuck segments (awaiting_prev_first_frame)
  const stuckSegments = segments.filter(s => s.status === 'awaiting_prev_first_frame');
  console.log(`[Batch Fix] Found ${stuckSegments.length} stuck segments: ${stuckSegments.map(s => s.segment_index).join(', ')}`);

  if (stuckSegments.length === 0) {
    console.log(`[Batch Fix] ✅ No stuck segments found, project is healthy`);
    return { success: true, fixed: 0 };
  }

  // Get brand data
  let brandLogoUrl: string | null = null;
  let productImageUrls: string[] | null = null;

  if (project.selected_brand_id) {
    const { data: brand } = await supabase
      .from('user_brands')
      .select('brand_logo_url')
      .eq('id', project.selected_brand_id)
      .single();

    brandLogoUrl = brand?.brand_logo_url || null;

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

  // Fix each stuck segment sequentially (must wait for previous to complete)
  let fixedCount = 0;
  const aspectRatio = (project.video_aspect_ratio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16';
  const competitorFileType = project.competitor_file_type as 'video' | null;

  for (const segment of stuckSegments) {
    try {
      console.log(`\n[Batch Fix] Fixing segment ${segment.segment_index}...`);

      // Get previous segment's first frame
      const prevSegment = segments.find(s => s.segment_index === segment.segment_index - 1);
      if (!prevSegment || !prevSegment.first_frame_url) {
        console.error(`[Batch Fix] ❌ Segment ${segment.segment_index}: Previous segment has no first frame`);
        continue;
      }

      console.log(`[Batch Fix] Previous segment ${segment.segment_index - 1} first frame: ${prevSegment.first_frame_url}`);

      // Mark as generating
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({ status: 'generating_first_frame' })
        .eq('id', segment.id);

      // Trigger frame generation
      const segmentPrompt = segment.prompt as SegmentPrompt;
      const taskId = await createSmartSegmentFrame(
        segmentPrompt,
        segment.segment_index,
        'first',
        aspectRatio,
        brandLogoUrl,
        productImageUrls,
        undefined, // brandContext
        competitorFileType,
        undefined, // overrides
        prevSegment.first_frame_url // continuation reference
      );

      // Save task ID
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({ first_frame_task_id: taskId })
        .eq('id', segment.id);

      console.log(`[Batch Fix] ✅ Segment ${segment.segment_index} triggered, task ID: ${taskId}`);
      fixedCount++;

    } catch (error) {
      console.error(`[Batch Fix] ❌ Failed to fix segment ${segment.segment_index}:`, error);

      // Mark as failed
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Batch fix failed'
        })
        .eq('id', segment.id);
    }
  }

  return { success: true, fixed: fixedCount, total: stuckSegments.length };
}

async function main() {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  Batch Fix for Stuck Segments          ║`);
  console.log(`║  Total projects: ${STUCK_PROJECTS.length}                      ║`);
  console.log(`╚════════════════════════════════════════╝\n`);

  const results = [];

  for (const { projectId, segmentCount } of STUCK_PROJECTS) {
    const result = await fixStuckProject(projectId, segmentCount);
    results.push({ projectId, ...result });

    // Wait a bit between projects to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n\n╔════════════════════════════════════════╗`);
  console.log(`║  Batch Fix Complete                    ║`);
  console.log(`╚════════════════════════════════════════╝\n`);

  results.forEach(({ projectId, success, fixed, total, error }) => {
    if (success) {
      console.log(`✅ ${projectId}: Fixed ${fixed}/${total || 0} segments`);
    } else {
      console.log(`❌ ${projectId}: ${error}`);
    }
  });

  console.log(`\n[Batch Fix] All webhooks will be received shortly...`);
}

main()
  .then(() => {
    console.log('\n[Batch Fix] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Batch Fix] Script failed:', error);
    process.exit(1);
  });
