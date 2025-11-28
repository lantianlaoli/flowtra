import { getSupabaseAdmin } from '@/lib/supabase';

const PROJECT_ID = process.argv[2] || 'c373e3b8-91ea-4ae2-91a6-57cc110eeeb2';
const BASE_URL =
  process.env.MONITOR_ENDPOINT ??
  `${process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/standard-ads/monitor-tasks`;

async function callMonitorEndpoint(projectId?: string) {
  console.log(`🔁 Hitting monitor endpoint: ${BASE_URL}${projectId ? ` (targeting ${projectId})` : ''}`);
  const started = Date.now();
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: projectId ? { 'Content-Type': 'application/json' } : undefined,
    body: projectId ? JSON.stringify({ projectId }) : undefined
  });
  const duration = Date.now() - started;
  const text = await response.text();
  console.log(`   → Status ${response.status} in ${duration}ms`);
  console.log(text.slice(0, 2000));
}

async function printProjectSnapshot(projectId: string) {
  const supabase = getSupabaseAdmin();

  const { data: project } = await supabase
    .from('standard_ads_projects')
    .select('id,status,current_step,error_message,segment_status')
    .eq('id', projectId)
    .single();

  if (!project) {
    console.error(`⚠️ Project ${projectId} not found`);
    return;
  }

  console.log('\n📋 Project snapshot:');
  console.table([
    {
      id: project.id,
      status: project.status,
      step: project.current_step,
      error: project.error_message || '',
      videosReady: (project.segment_status as { videosReady?: number })?.videosReady ?? 'n/a'
    }
  ]);

  const { data: segments } = await supabase
    .from('standard_ads_segments')
    .select('id,segment_index,status,video_url,first_frame_url,error_message,updated_at')
    .eq('project_id', projectId)
    .order('segment_index', { ascending: true });

  console.log('\n🎬 Segment statuses:');
  if (!segments?.length) {
    console.log('No segment rows found');
    return;
  }

  console.table(
    segments.map(seg => ({
      index: seg.segment_index,
      status: seg.status,
      hasVideo: Boolean(seg.video_url),
      firstFrame: !!seg.first_frame_url,
      error: seg.error_message || '',
      updated_at: seg.updated_at
    }))
  );
}

async function main() {
  try {
    await callMonitorEndpoint(PROJECT_ID);
    await printProjectSnapshot(PROJECT_ID);
  } catch (error) {
    console.error('❌ Debug script failed:', error);
    process.exitCode = 1;
  }
}

main();
