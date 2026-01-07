/**
 * Manual fix script for stuck segment continuation
 * Manually triggers segment 1 frame generation for projects where webhook failed
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { createSmartSegmentFrame } from '@/lib/competitor-ugc-replication-workflow';

const PROJECT_IDS = [
  'd266cd4d-935f-4ea8-ad23-aa524a3ffdbc', // 5 segments
  'f54b2df2-af09-4bc9-9c8c-aaa6cd3d4571'  // 2 segments
];

async function fixStuckSegments() {
  const supabase = getSupabaseAdmin();

  for (const projectId of PROJECT_IDS) {
    console.log(`\n🔧 Processing project ${projectId}...`);

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error(`❌ Project not found: ${projectId}`);
      continue;
    }

    // Fetch all segments
    const { data: segments, error: segmentsError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('*')
      .eq('project_id', projectId)
      .order('segment_index', { ascending: true });

    if (segmentsError || !segments) {
      console.error(`❌ Segments not found for project ${projectId}`);
      continue;
    }

    const segment0 = segments.find(s => s.segment_index === 0);
    const segment1 = segments.find(s => s.segment_index === 1);

    if (!segment0 || !segment1) {
      console.error(`❌ Segment 0 or 1 not found`);
      continue;
    }

    // Check if segment 0 has first_frame_url
    if (!segment0.first_frame_url) {
      console.error(`❌ Segment 0 doesn't have first_frame_url yet`);
      continue;
    }

    // Check if segment 1 is stuck
    if (segment1.status !== 'awaiting_prev_first_frame') {
      console.log(`⏭️  Segment 1 status is ${segment1.status}, skipping`);
      continue;
    }

    console.log(`✅ Segment 0 first frame ready: ${segment0.first_frame_url}`);
    console.log(`🔄 Triggering segment 1 frame generation...`);

    try {
      // Extract data from segment 1 prompt
      const segmentPrompt = segment1.prompt as any;
      const aspectRatio = project.video_aspect_ratio || '16:9';
      const brandLogoUrl = (project as any).brand_logo_url || null;
      const productImageUrls = (project as any).product_image_urls || null;

      // Mark segment 1 as generating
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          status: 'generating_first_frame',
          updated_at: new Date().toISOString()
        })
        .eq('id', segment1.id);

      // Trigger frame generation
      const taskId = await createSmartSegmentFrame(
        segmentPrompt,
        1, // segment index
        'first',
        aspectRatio,
        brandLogoUrl,
        productImageUrls,
        undefined, // brandContext
        null, // competitorFileType
        undefined, // overrides
        segment0.first_frame_url // Use segment 0's frame as continuation reference
      );

      // Save task ID
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          first_frame_task_id: taskId,
          updated_at: new Date().toISOString()
        })
        .eq('id', segment1.id);

      console.log(`✅ Segment 1 frame generation triggered! Task ID: ${taskId}`);

    } catch (error) {
      console.error(`❌ Failed to trigger segment 1:`, error);

      // Mark as failed
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Manual trigger failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', segment1.id);
    }
  }

  console.log(`\n✅ Done!`);
}

fixStuckSegments().catch(console.error);
