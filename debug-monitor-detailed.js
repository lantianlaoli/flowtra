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

const PROJECT_ID = '176a65f3-d8e4-42a8-868d-0b9373e91934';

async function debugMonitorLogic() {
  console.log('=== 调试监控任务逻辑 ===');
  
  try {
    // 1. 获取项目当前状态
    const { data: project, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', PROJECT_ID)
      .single();

    if (error) {
      throw error;
    }

    console.log('项目当前状态:', {
      id: project.id,
      status: project.status,
      current_step: project.current_step,
      merged_video_url: project.merged_video_url,
      fal_merge_task_id: project.fal_merge_task_id,
      progress_percentage: project.progress_percentage
    });

    // 2. 模拟监控任务的逻辑判断
    console.log('\n=== 模拟监控任务逻辑判断 ===');
    
    let nextStep = null;
    
    switch (project.current_step) {
      case 'merging_videos':
        console.log('当前步骤是 merging_videos');
        
        if (!project.fal_merge_task_id) {
          console.log('没有 fal_merge_task_id，应该执行 merge_videos');
          nextStep = 'merge_videos';
        } else if (project.fal_merge_task_id && !project.merged_video_url) {
          console.log('有 fal_merge_task_id 但没有 merged_video_url，应该执行 check_merge_status');
          nextStep = 'check_merge_status';
        } else {
          console.log('已有 merged_video_url，无需进一步处理');
        }
        break;
        
      default:
        console.log('当前步骤不是 merging_videos:', project.current_step);
    }
    
    console.log('确定的 nextStep:', nextStep);
    
    if (nextStep) {
      console.log('\n=== 手动执行步骤 ===');
      
      // 动态导入 workflow 模块
      const { processCharacterAdsProject } = await import('./lib/character-ads-workflow.ts');
      
      try {
        const result = await processCharacterAdsProject(project, nextStep);
        console.log('步骤执行结果:', result);
        
        // 检查更新后的项目状态
        const { data: updatedProject, error: updateError } = await supabase
          .from('character_ads_projects')
          .select('*')
          .eq('id', PROJECT_ID)
          .single();

        if (updateError) {
          throw updateError;
        }

        console.log('\n更新后的项目状态:', {
          id: updatedProject.id,
          status: updatedProject.status,
          current_step: updatedProject.current_step,
          merged_video_url: updatedProject.merged_video_url,
          fal_merge_task_id: updatedProject.fal_merge_task_id,
          progress_percentage: updatedProject.progress_percentage,
          error_message: updatedProject.error_message
        });
        
      } catch (stepError) {
        console.error('步骤执行失败:', stepError);
        console.error('错误详情:', stepError.message);
      }
    }
    
  } catch (error) {
    console.error('调试失败:', error);
  }
}

debugMonitorLogic();