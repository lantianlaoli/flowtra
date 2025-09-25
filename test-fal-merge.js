#!/usr/bin/env node

// Test script for fal.ai video merging
import { fal } from "@fal-ai/client";
import { readFileSync } from 'fs';

// Load environment variables from .env
try {
  const envContent = readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('='); // Handle values with = in them
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

// Video URLs from the failed record
const videoUrls = [
  "https://tempfile.aiquickdraw.com/p/32ac1f1c183e9c0306771ec21f02a7e4_1758806507.mp4",
  "https://tempfile.aiquickdraw.com/p/f6590f58e01a477113bb6432f9416556_1758806482.mp4"
];

console.log('Starting fal.ai video merge test...');
console.log('Video URLs to merge:', videoUrls);

async function testFalMerge() {
  try {
    console.log('\n🚀 Submitting merge request to fal.ai...');
    
    const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
      input: {
        video_urls: videoUrls,
        target_fps: 30,
        resolution: "landscape_16_9"
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`📊 Queue update: ${update.status}`);
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(msg => {
            console.log(`📝 Log: ${msg}`);
          });
        }
      }
    });

    console.log('\n✅ Merge completed successfully!');
    console.log('Request ID:', result.requestId);
    console.log('Result data:', JSON.stringify(result.data, null, 2));
    
    if (result.data?.video?.url) {
      console.log('\n🎬 Merged video URL:', result.data.video.url);
    }

    return result;
    
  } catch (error) {
    console.error('\n❌ Merge failed:', error);
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    if (error.body) {
      console.error('Error body:', JSON.stringify(error.body, null, 2));
    }
    
    throw error;
  }
}

// Run the test
testFalMerge()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });