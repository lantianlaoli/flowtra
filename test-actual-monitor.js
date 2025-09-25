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

async function testMonitoringTask() {
  console.log('开始完整的监控任务测试...\n');

  // 1. 重置项目状态为测试
  console.log('=== 重置项目状态为测试 ===');
  const projectId = '176a65f3-d8e4-42a8-868d-0b9373e91934';
  
  const { data: resetData, error: resetError } = await supabase
    .from('character_ads_projects')
    .update({
      status: 'merging_videos',
      current_step: 'merging_videos',
      merged_video_url: null,
      progress_percentage: 90,
      last_processed_at: null, // 重置这个字段，确保监控任务会处理它
      error_message: null
    })
    .eq('id', projectId)
    .select()
    .single();

  if (resetError) {
    console.error('重置项目状态失败:', resetError);
    return;
  }

  console.log('项目状态已重置为merging_videos:', resetData);

  // 等待一下确保数据库更新完成
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. 触发监控任务
  console.log('\n=== 触发监控任务 ===');
  const response = await fetch('http://localhost:3000/api/character-ads/monitor-tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();
  console.log('监控任务执行结果:', result);

  // 等待一下让监控任务完成
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 3. 检查项目最终状态
  console.log('\n=== 检查项目最终状态 ===');
  const { data: finalData, error: finalError } = await supabase
    .from('character_ads_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (finalError) {
    console.error('获取项目最终状态失败:', finalError);
    return;
  }

  console.log('项目最终状态:', finalData);

  // 4. 分析结果
  console.log('\n=== 测试结果分析 ===');
  if (finalData.status === 'completed' && finalData.merged_video_url) {
    console.log('✅ 监控任务成功处理了项目');
    console.log('合并视频URL:', finalData.merged_video_url);
  } else if (finalData.status === 'failed') {
    console.log('❌ 项目处理失败');
    console.log('错误信息:', finalData.error_message);
  } else {
    console.log('⚠️  项目仍处于merging_videos状态，监控任务可能没有处理到这个项目');
    console.log('可能的原因:');
    console.log('- 监控任务的查询条件有问题');
    console.log('- 监控任务执行时间太短');
    console.log('- 网络错误导致FAL API调用失败');
    console.log('- last_processed_at字段影响了处理逻辑');
  }
}

testMonitoringTask();