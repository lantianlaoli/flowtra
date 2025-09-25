#!/usr/bin/env node

import { fal } from '@fal-ai/client';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables manually
const envContent = readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    const value = valueParts.join('=');
    process.env[key.trim()] = value.trim();
  }
});

// Configure FAL client
fal.config({
  credentials: process.env.FAL_KEY,
});

// Configure Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndFixFailedRecords() {
  console.log('Checking failed records with fal_merge_task_id...');
  
  // Get failed records that have fal_merge_task_id
  const { data: failedRecords, error } = await supabase
    .from('character_ads_projects')
    .select('id, fal_merge_task_id, status, error_message, created_at')
    .eq('status', 'failed')
    .not('fal_merge_task_id', 'is', null)
    .like('error_message', '%fetch failed%');

  if (error) {
    console.error('Error fetching failed records:', error);
    return;
  }

  console.log(`Found ${failedRecords.length} failed records with task IDs`);

  for (const record of failedRecords) {
    console.log(`\nChecking record ${record.id} with task ${record.fal_merge_task_id}...`);
    
    try {
      // Check FAL task status
      const status = await fal.queue.status('fal-ai/ffmpeg-api/merge-videos', {
        requestId: record.fal_merge_task_id,
      });
      
      console.log(`Task status: ${status.status}`);
      
      if (status.status === 'COMPLETED') {
        // Get the result
        const result = await fal.queue.result('fal-ai/ffmpeg-api/merge-videos', {
          requestId: record.fal_merge_task_id,
        });
        
        const videoUrl = result.data.video.url;
        console.log(`Task completed! Video URL: ${videoUrl}`);
        
        // Update the record
        const { error: updateError } = await supabase
          .from('character_ads_projects')
          .update({
            status: 'completed',
            merged_video_url: videoUrl,
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
          
        if (updateError) {
          console.error(`Error updating record ${record.id}:`, updateError);
        } else {
          console.log(`✅ Successfully updated record ${record.id}`);
        }
      } else {
        console.log(`Task status: ${status.status} - no action needed`);
      }
      
    } catch (error) {
      console.error(`Error checking task ${record.fal_merge_task_id}:`, error.message);
    }
  }
}

checkAndFixFailedRecords()
  .then(() => {
    console.log('\nFinished checking failed records');
  })
  .catch((error) => {
    console.error('Script failed:', error);
  });