/**
 * Quick script to check segment webhook status
 */
import { getSupabaseAdmin } from '@/lib/supabase';

const taskId = 'f1acaa076275d4b13e76fa9e396d1161';

async function checkSegmentStatus() {
  const supabase = getSupabaseAdmin();

  console.log(`🔍 Checking segment with taskId: ${taskId}\n`);

  const { data: segment, error } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('*')
    .eq('first_frame_task_id', taskId)
    .single();

  if (error || !segment) {
    console.error('❌ Segment not found:', error);
    return;
  }

  console.log('✅ Segment found:\n');
  console.log('ID:', segment.id);
  console.log('Project ID:', segment.project_id);
  console.log('Segment Index:', segment.segment_index);
  console.log('Status:', segment.status);
  console.log('First Frame Task ID:', segment.first_frame_task_id);
  console.log('First Frame URL:', segment.first_frame_url || '❌ NULL');
  console.log('First Frame Webhook Received At:', segment.first_frame_webhook_received_at || '❌ NULL');
  console.log('Updated At:', segment.updated_at);
  console.log('');

  if (segment.first_frame_webhook_received_at) {
    console.log('⚠️ WARNING: Webhook timestamp is set!');
    console.log('This will cause the webhook to skip processing with "Already processed"');
    console.log('');
    console.log('💡 Solution: You need to manually clear this timestamp:');
    console.log('');
    console.log(`UPDATE competitor_ugc_replication_segments SET first_frame_webhook_received_at = NULL WHERE id = '${segment.id}';`);
    console.log('');
  }

  if (!segment.first_frame_url) {
    console.log('⚠️ WARNING: No first_frame_url set!');
    console.log('The webhook either has not been called yet, or it was blocked by the idempotency check.');
    console.log('');
  }
}

checkSegmentStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
