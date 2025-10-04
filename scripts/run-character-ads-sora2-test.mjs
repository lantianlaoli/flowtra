// This script resets the latest character_ads_projects record to produce a 9:16 Sora2 video
// Then it periodically triggers the monitor-tasks endpoint and polls DB until completed/failed.
// Usage: pnpm test:sora2-monitor

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[Error] Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const INTERVAL_MS = parseInt(process.env.MONITOR_INTERVAL_MS || '15000', 10); // 15s
const MAX_MINUTES = parseInt(process.env.MONITOR_MAX_MINUTES || '45', 10); // 45 minutes
const MAX_TICKS = Math.ceil((MAX_MINUTES * 60_000) / INTERVAL_MS);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getLatestProject() {
  const { data, error } = await supabase
    .from('character_ads_projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function resetProjectForSora2(project) {
  // Clean project to restart workflow with Sora2 and 9:16
  const { data, error } = await supabase
    .from('character_ads_projects')
    .update({
      video_model: 'sora2',
      video_aspect_ratio: '9:16',
      status: 'analyzing_images',
      current_step: 'analyzing_images',
      progress_percentage: 0,
      error_message: null,
      image_analysis_result: null,
      generated_prompts: null,
      generated_image_url: null,
      generated_video_urls: null,
      kie_image_task_id: null,
      kie_video_task_ids: null,
      fal_merge_task_id: null,
      merged_video_url: null,
      updated_at: new Date().toISOString(),
      last_processed_at: null,
    })
    .eq('id', project.id)
    .select()
    .single();
  if (error) throw error;

  // Remove old scenes to ensure clean re-generation
  await supabase.from('character_ads_scenes').delete().eq('project_id', project.id);

  return data;
}

async function triggerStep(projectId, step) {
  const res = await fetch(`${SITE_URL}/api/character-ads/${projectId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[Warn] Trigger step failed: ${res.status} ${res.statusText} - ${text}`);
  }
}

async function callMonitor() {
  const res = await fetch(`${SITE_URL}/api/character-ads/monitor-tasks`, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[Warn] monitor-tasks failed: ${res.status} ${res.statusText} - ${text}`);
  }
}

async function getProjectState(projectId) {
  const { data, error } = await supabase
    .from('character_ads_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error) throw error;
  return data;
}

function logState(p) {
  const fields = {
    id: p.id,
    status: p.status,
    step: p.current_step,
    progress: p.progress_percentage,
    video_model: p.video_model,
    video_aspect_ratio: p.video_aspect_ratio,
    kie_image_task_id: p.kie_image_task_id,
    kie_video_task_ids: Array.isArray(p.kie_video_task_ids) ? p.kie_video_task_ids.length : 0,
    generated_image_url: !!p.generated_image_url,
    generated_video_urls: Array.isArray(p.generated_video_urls) ? p.generated_video_urls.length : 0,
    merged_video_url: !!p.merged_video_url,
    updated_at: p.updated_at,
  };
  console.log('[State]', JSON.stringify(fields));
}

async function main() {
  console.log('> Fetching latest character_ads_projects record...');
  const latest = await getLatestProject();
  if (!latest) {
    console.error('[Error] No character_ads_projects records found. Please create one first.');
    process.exit(1);
  }
  console.log(`> Latest project: ${latest.id}`);

  console.log('> Resetting project for Sora2 9:16...');
  const project = await resetProjectForSora2(latest);
  logState(project);

  console.log('> Triggering initial step analyze_images...');
  await triggerStep(project.id, 'analyze_images');

  console.log('> Starting periodic monitor + poll loop...');
  let tick = 0;
  while (tick < MAX_TICKS) {
    tick += 1;
    await callMonitor();
    const state = await getProjectState(project.id);
    logState(state);
    if (state.status === 'completed' || state.status === 'failed') {
      console.log(`> Finished with status=${state.status}`);
      if (state.status === 'completed') {
        console.log(`> Merged video url: ${state.merged_video_url || '(single scene uses generated video)'}`);
      } else {
        console.log(`> Error message: ${state.error_message || '(none)'}`);
      }
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  console.warn('> Reached maximum monitoring time without terminal state. Exiting.');
  process.exit(2);
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});

