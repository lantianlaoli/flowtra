#!/usr/bin/env node

import { fal } from '@fal-ai/client';
import { readFileSync } from 'fs';

// Load environment variables manually
const envContent = readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});
process.env.FAL_KEY = envVars.FAL_KEY;

// Configure FAL client
fal.config({
  credentials: process.env.FAL_KEY,
});

const taskId = 'd841da15-438e-43d0-8694-f02c8f7d6b71'; // 真实失败记录的task_id

console.log('Getting FAL task result for:', taskId);

try {
  const result = await fal.queue.result('fal-ai/ffmpeg-api/merge-videos', {
    requestId: taskId,
  });
  
  console.log('Task result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Failed to get result:', error.message);
  if (error.cause) {
    console.error('Cause:', error.cause);
  }
}