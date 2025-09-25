#!/usr/bin/env node

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env
try {
  const envContent = readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=');
      process.env[key.trim()] = value.trim();
    }
  });
} catch (error) {
  console.log('No .env file found, using system environment variables');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimple() {
  const projectId = '176a65f3-d8e4-42a8-868d-0b9373e91934';
  
  console.log('=== 检查项目当前状态 ===');
  const { data: beforeData } = await supabase
    .from('character_ads_projects')
    .select('status, current_step, merged_video_url, fal_merge_task_id, last_processed_at')
    .eq('id', projectId)
    .single();
  
  console.log('处理前状态:', beforeData);
  
  // 确保项目处于正确状态
  await supabase
    .from('character_ads_projects')
    .update({
      status: 'merging_videos',
      current_step: 'merging_videos',
      merged_video_url: null,
      last_processed_at: null
    })
    .eq('id', projectId);
  
  console.log('\n=== 调用监控任务 ===');
  const response = await fetch('http://localhost:3000/api/character-ads/monitor-tasks', {
    method: 'POST'
  });
  
  const result = await response.json();
  console.log('监控任务结果:', result);
  
  // 等待处理完成
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n=== 检查项目处理后状态 ===');
  const { data: afterData } = await supabase
    .from('character_ads_projects')
    .select('status, current_step, merged_video_url, fal_merge_task_id, last_processed_at, error_message')
    .eq('id', projectId)
    .single();
  
  console.log('处理后状态:', afterData);
  
  // 比较变化
  console.log('\n=== 变化分析 ===');
  console.log('last_processed_at 是否更新:', beforeData.last_processed_at !== afterData.last_processed_at);
  console.log('status 是否变化:', beforeData.status !== afterData.status);
  console.log('merged_video_url 是否设置:', !!afterData.merged_video_url);
  
  if (afterData.error_message) {
    console.log('错误信息:', afterData.error_message);
  }
}

testSimple();