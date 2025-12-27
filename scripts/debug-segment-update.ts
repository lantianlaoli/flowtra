/**
 * Debug Script: Segment Photo Update Issue
 *
 * This script helps diagnose why regenerated segment photos don't appear in the UI
 * despite webhook success.
 *
 * Usage:
 *   npx tsx scripts/debug-segment-update.ts <project_id> <segment_index>
 *
 * Example:
 *   npx tsx scripts/debug-segment-update.ts abc123 0
 */

import { getSupabaseAdmin } from '@/lib/supabase';

async function debugSegmentUpdate(projectId: string, segmentIndex: number) {
  console.log('🔍 Debugging Segment Photo Update\n');
  console.log(`Project ID: ${projectId}`);
  console.log(`Segment Index: ${segmentIndex}\n`);

  const supabase = getSupabaseAdmin();

  // 1. Check project exists
  console.log('1️⃣ Fetching project...');
  const { data: project, error: projectError } = await supabase
    .from('competitor_ugc_replication_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error('❌ Project not found:', projectError);
    return;
  }

  console.log('✅ Project found');
  console.log(`   Status: ${project.status}`);
  console.log(`   Is Segmented: ${project.is_segmented}`);
  console.log(`   Segment Count: ${project.segment_count}`);
  console.log('');

  // 2. Check segment exists
  console.log('2️⃣ Fetching segment...');
  const { data: segment, error: segmentError } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('*')
    .eq('project_id', projectId)
    .eq('segment_index', segmentIndex)
    .single();

  if (segmentError || !segment) {
    console.error('❌ Segment not found:', segmentError);
    return;
  }

  console.log('✅ Segment found');
  console.log(`   Status: ${segment.status}`);
  console.log(`   First Frame URL: ${segment.first_frame_url ? '✅ Present' : '❌ Missing'}`);
  console.log(`   First Frame Task ID: ${segment.first_frame_task_id || 'None'}`);
  console.log(`   Video URL: ${segment.video_url ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Video Task ID: ${segment.video_task_id || 'None'}`);
  console.log(`   Error: ${segment.error_message || 'None'}`);
  console.log(`   Updated At: ${segment.updated_at}`);
  console.log(`   Frame Webhook Received: ${segment.first_frame_webhook_received_at || 'Never'}`);
  console.log(`   Video Webhook Received: ${segment.video_webhook_received_at || 'Never'}`);
  console.log('');

  // 3. Show full first frame URL if present
  if (segment.first_frame_url) {
    console.log('3️⃣ First Frame URL Details:');
    console.log(`   ${segment.first_frame_url}`);
    console.log('');
  }

  // 4. Check if URL is accessible
  if (segment.first_frame_url) {
    console.log('4️⃣ Testing URL accessibility...');
    try {
      const response = await fetch(segment.first_frame_url, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ URL is accessible');
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
      } else {
        console.error('❌ URL returned error');
        console.error(`   Status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch URL:', error instanceof Error ? error.message : error);
    }
    console.log('');
  }

  // 5. Check segment_status in project
  console.log('5️⃣ Checking project segment_status...');
  const segmentStatus = project.segment_status as {
    total?: number;
    framesReady?: number;
    videosReady?: number;
    segments?: Array<{
      index: number;
      status: string;
      firstFrameUrl?: string | null;
      videoUrl?: string | null;
    }>;
  } | null;

  if (!segmentStatus) {
    console.warn('⚠️ segment_status is null in project');
  } else {
    console.log(`   Total: ${segmentStatus.total}`);
    console.log(`   Frames Ready: ${segmentStatus.framesReady}`);
    console.log(`   Videos Ready: ${segmentStatus.videosReady}`);

    if (segmentStatus.segments) {
      const targetSegment = segmentStatus.segments.find(s => s.index === segmentIndex);
      if (targetSegment) {
        console.log(`   Target Segment ${segmentIndex}:`);
        console.log(`     Status: ${targetSegment.status}`);
        console.log(`     First Frame URL: ${targetSegment.firstFrameUrl ? '✅ Present' : '❌ Missing'}`);
      } else {
        console.warn(`⚠️ Segment ${segmentIndex} not found in segment_status array`);
      }
    }
  }
  console.log('');

  // 6. Recommendations
  console.log('6️⃣ Diagnostic Summary:\n');

  if (!segment.first_frame_url) {
    console.log('❌ ISSUE: Segment has no first_frame_url');
    console.log('   Possible causes:');
    console.log('   - Webhook has not been received yet');
    console.log('   - KIE API task failed');
    console.log('   - Webhook handler failed to update database');
    console.log('');
  } else if (!segmentStatus?.segments?.find(s => s.index === segmentIndex)?.firstFrameUrl) {
    console.log('❌ ISSUE: first_frame_url exists in segment table but not in project.segment_status');
    console.log('   Possible causes:');
    console.log('   - Webhook handler did not update project.segment_status');
    console.log('   - Race condition between segment update and project update');
    console.log('');
    console.log('💡 Recommended Action:');
    console.log('   Check webhook handler at: /api/competitor-ugc-replication/webhooks/frame');
    console.log('   Ensure it updates both segment table AND project.segment_status');
    console.log('');
  } else {
    console.log('✅ Database state looks correct!');
    console.log('   The issue is likely in the frontend:');
    console.log('   - Realtime subscription may not be triggering');
    console.log('   - fetchStatusForProject may not be called');
    console.log('   - updateGenerationFromStatus may not be updating React state');
    console.log('');
    console.log('💡 Recommended Actions:');
    console.log('   1. Check browser console for Realtime connection logs');
    console.log('   2. Verify "fetchStatusForProject" is called after regeneration');
    console.log('   3. Check if segments array is properly updated in React state');
    console.log('   4. Try manually refreshing the page (F5) to see if photo appears');
    console.log('');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/debug-segment-update.ts <project_id> <segment_index>');
  process.exit(1);
}

const [projectId, segmentIndexStr] = args;
const segmentIndex = parseInt(segmentIndexStr, 10);

if (isNaN(segmentIndex) || segmentIndex < 0) {
  console.error('Error: segment_index must be a non-negative integer');
  process.exit(1);
}

debugSegmentUpdate(projectId, segmentIndex)
  .then(() => {
    console.log('✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });
