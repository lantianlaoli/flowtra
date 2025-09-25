#!/usr/bin/env node

import { readFileSync } from 'fs';

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

// 模拟一个处于merging_videos状态的项目
const mockProject = {
  id: '176a65f3-d8e4-42a8-868d-0b9373e91934',
  status: 'merging_videos',
  current_step: 'merging_videos',
  fal_merge_task_id: '6597faa9-871b-41fb-9bc2-ed5ae6282c2a',
  merged_video_url: null,
  progress_percentage: 90
};

async function debugMonitorLogic() {
  console.log('=== 调试监控任务逻辑 ===');
  console.log('模拟项目状态:', mockProject);
  
  // 模拟监控任务的判断逻辑
  let nextStep = null;
  
  switch (mockProject.status) {
    case 'merging_videos':
      if (!mockProject.fal_merge_task_id) {
        nextStep = 'merge_videos';
        console.log('❌ 没有fal_merge_task_id，需要执行merge_videos');
      } else if (mockProject.fal_merge_task_id && !mockProject.merged_video_url) {
        nextStep = 'check_merge_status';
        console.log('✅ 有fal_merge_task_id但没有merged_video_url，应该执行check_merge_status');
      } else {
        console.log('✅ 合并已完成，无需操作');
      }
      break;
    default:
      console.log('状态不是merging_videos，跳过');
  }
  
  if (nextStep) {
    console.log(`\n=== 应该执行的下一步: ${nextStep} ===`);
    
    if (nextStep === 'check_merge_status') {
      console.log('模拟执行check_merge_status步骤...');
      
      // 模拟FAL API调用
      try {
        const { fal } = await import("@fal-ai/client");
        
        fal.config({
          credentials: process.env.FAL_KEY
        });
        
        console.log('检查FAL任务状态...');
        const statusResult = await fal.queue.status("fal-ai/ffmpeg-api/merge-videos", {
          requestId: mockProject.fal_merge_task_id
        });
        
        console.log('FAL状态结果:', statusResult);
        
        if (statusResult.status === 'COMPLETED') {
          console.log('✅ FAL任务已完成，获取结果...');
          const result = await fal.queue.result("fal-ai/ffmpeg-api/merge-videos", {
            requestId: mockProject.fal_merge_task_id
          });
          
          const videoUrl = result.data.video.url;
          console.log('✅ 获取到视频URL:', videoUrl);
          console.log('✅ 应该更新数据库: merged_video_url =', videoUrl);
          console.log('✅ 应该更新状态: status = completed, progress = 100%');
          
        } else {
          console.log('⏳ FAL任务还在处理中，状态:', statusResult.status);
        }
        
      } catch (error) {
        console.error('❌ FAL API调用失败:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        
        // 检查是否是网络错误
        const isNetworkError = error.message.includes('fetch failed') ||
                              error.message.includes('EAI_AGAIN') ||
                              error.message.includes('ENOTFOUND') ||
                              error.message.includes('ECONNRESET') ||
                              error.message.includes('timeout');
        
        if (isNetworkError) {
          console.log('🔍 这是网络错误，监控任务应该重试而不是失败');
        } else {
          console.log('🔍 这不是网络错误，可能是其他问题');
        }
      }
    }
  } else {
    console.log('无需执行任何步骤');
  }
}

debugMonitorLogic();