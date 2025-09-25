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

const taskId = 'd841da15-438e-43d0-8694-f02c8f7d6b71'; // 真实失败记录的task_id

console.log('Checking FAL task status for:', taskId);

async function checkStatus() {
  try {
    const result = await fal.queue.status("fal-ai/ffmpeg-api/merge-videos", {
      requestId: taskId
    });

    console.log('Status result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Status check failed:', error);
    console.error('Error message:', error.message);
    console.error('Error body:', error.body);
  }
}

checkStatus();
