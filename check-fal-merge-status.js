#!/usr/bin/env node

import { fal } from "@fal-ai/client";
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

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY
});

const taskId = '6597faa9-871b-41fb-9bc2-ed5ae6282c2a';

async function checkFalMergeStatus() {
  try {
    console.log(`检查FAL合并任务状态: ${taskId}`);
    
    // 检查任务状态
    const statusResult = await fal.queue.status("fal-ai/ffmpeg-api/merge-videos", {
      requestId: taskId
    });

    console.log('FAL合并任务状态:', JSON.stringify(statusResult, null, 2));

    // 如果任务完成，获取结果
    if (statusResult.status === 'COMPLETED') {
      console.log('\n=== 任务已完成，获取结果 ===');
      const result = await fal.queue.result("fal-ai/ffmpeg-api/merge-videos", {
        requestId: taskId
      });
      console.log('合并结果:', JSON.stringify(result, null, 2));
    } else if (statusResult.status === 'FAILED') {
      console.log('\n❌ 任务失败');
      console.log('失败详情:', statusResult);
    } else {
      console.log(`\n⏳ 任务状态: ${statusResult.status}`);
    }

  } catch (error) {
    console.error('检查FAL状态时出错:', error);
    console.error('错误详情:', error.message);
    if (error.body) {
      console.error('错误体:', error.body);
    }
  }
}

checkFalMergeStatus();