/**
 * TikTok Publish Testing Script
 *
 * This script helps debug TikTok video publishing issues by testing each step independently.
 *
 * Usage:
 *   npx tsx scripts/test-tiktok-publish.ts
 */

import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';
import { fetchVideoBuffer, validateVideo, calculateChunks, uploadChunk } from '../lib/tiktok-upload-helper';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Decryption setup
const ENCRYPTION_KEY = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY ||
  process.env.TIKTOK_CLIENT_SECRET!.slice(0, 32).padEnd(32, '0');
const ALGORITHM = 'aes-256-cbc';

function decryptToken(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function testTikTokConnection() {
  console.log('📱 [Test 1] Checking TikTok connection...\n');

  const { data: connection, error } = await supabase
    .from('user_tiktok_connections')
    .select('*')
    .eq('user_id', 'user_31j68a38A3Q4CDNgdXvWRgiCK7A')
    .maybeSingle();

  if (error || !connection) {
    console.error('❌ TikTok connection not found:', error);
    return null;
  }

  console.log('✅ TikTok connection found');
  console.log('   User:', connection.display_name);
  console.log('   Token expires:', connection.token_expires_at);

  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (expiresAt < now) {
    console.error('❌ Token has expired!');
    return null;
  }

  console.log(`✅ Token is valid (${hoursLeft.toFixed(2)} hours remaining)\n`);

  return connection;
}

async function testTokenValidity(connection: any) {
  console.log('🔑 [Test 2] Testing access token...\n');

  const accessToken = decryptToken(connection.access_token);
  console.log('✅ Token decrypted successfully');
  console.log('   Token length:', accessToken.length);

  // Test token by calling TikTok user info API
  try {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('   API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Token validation failed:', errorData);
      return false;
    }

    const userData = await response.json();
    console.log('✅ Token is valid!');
    console.log('   TikTok User:', userData.data?.user?.display_name || 'Unknown');
    console.log('   Open ID:', userData.data?.user?.open_id || 'Unknown');
    console.log();

    return true;
  } catch (error) {
    console.error('❌ Token validation error:', error);
    return false;
  }
}

async function testVideoDownload(historyId: string) {
  console.log(`📹 [Test 3] Testing video download for history ID: ${historyId}...\n`);

  // Try to find video in all three tables
  const { data: standardAd } = await supabase
    .from('standard_ads_projects')
    .select('video_url, status')
    .eq('id', historyId)
    .eq('user_id', 'user_31j68a38A3Q4CDNgdXvWRgiCK7A')
    .maybeSingle();

  const { data: multiVariantAd } = await supabase
    .from('multi_variant_ads_projects')
    .select('video_url, status')
    .eq('id', historyId)
    .eq('user_id', 'user_31j68a38A3Q4CDNgdXvWRgiCK7A')
    .maybeSingle();

  const { data: characterAd } = await supabase
    .from('character_ads_projects')
    .select('merged_video_url, status')
    .eq('id', historyId)
    .eq('user_id', 'user_31j68a38A3Q4CDNgdXvWRgiCK7A')
    .maybeSingle();

  let videoUrl: string | null = null;

  if (standardAd?.status === 'completed' && standardAd.video_url) {
    videoUrl = standardAd.video_url;
    console.log('✅ Found video in standard_ads_projects');
  } else if (multiVariantAd?.status === 'completed' && multiVariantAd.video_url) {
    videoUrl = multiVariantAd.video_url;
    console.log('✅ Found video in multi_variant_ads_projects');
  } else if (characterAd?.status === 'completed' && characterAd.merged_video_url) {
    videoUrl = characterAd.merged_video_url;
    console.log('✅ Found video in character_ads_projects');
  }

  if (!videoUrl) {
    console.error('❌ Video not found or not completed');
    return null;
  }

  console.log('   Video URL:', videoUrl);
  console.log('   Downloading...');

  try {
    const startTime = Date.now();
    const videoBuffer = await fetchVideoBuffer(videoUrl);
    const duration = Date.now() - startTime;

    console.log(`✅ Video downloaded in ${duration}ms`);
    console.log('   Size:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');

    // Validate video
    const validation = validateVideo(videoBuffer);
    if (!validation.valid) {
      console.error('❌ Video validation failed:', validation.error);
      return null;
    }

    console.log('✅ Video validation passed\n');
    return videoBuffer;
  } catch (error) {
    console.error('❌ Video download failed:', error);
    return null;
  }
}

async function testTikTokInit(connection: any, videoBuffer: Buffer, title: string = 'Test Video') {
  console.log('🚀 [Test 4] Testing TikTok init API...\n');

  const accessToken = decryptToken(connection.access_token);
  const videoSize = videoBuffer.length;
  const { chunkSize, totalChunks } = calculateChunks(videoSize);

  console.log('   Video size:', (videoSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('   Chunks:', totalChunks);
  console.log('   Chunk size:', (chunkSize / 1024 / 1024).toFixed(2), 'MB');

  const initPayload = {
    post_info: {
      title,
      privacy_level: 'SELF_ONLY',  // Private for testing
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunks
    }
  };

  console.log('   Init payload:', JSON.stringify(initPayload, null, 2));

  try {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(initPayload)
      }
    );

    console.log('   Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Init failed:', errorData);
      return null;
    }

    const initData = await response.json();
    console.log('   Response:', JSON.stringify(initData, null, 2));

    if (initData.error?.code !== 'ok') {
      console.error('❌ Init error:', initData.error);
      return null;
    }

    console.log('✅ Init successful!');
    console.log('   Publish ID:', initData.data.publish_id);
    console.log('   Upload URL:', initData.data.upload_url);
    console.log();

    return initData.data;
  } catch (error) {
    console.error('❌ Init error:', error);
    return null;
  }
}

async function testChunkUpload(uploadUrl: string, videoBuffer: Buffer) {
  console.log('📤 [Test 5] Testing chunk upload...\n');

  const videoSize = videoBuffer.length;
  const { chunks } = calculateChunks(videoSize);

  console.log('   Total chunks:', chunks.length);
  console.log('   Testing first chunk only...\n');

  const chunk = chunks[0];
  const chunkBuffer = videoBuffer.slice(chunk.start, chunk.end + 1);

  try {
    const startTime = Date.now();
    await uploadChunk(uploadUrl, chunkBuffer, chunk, videoSize);
    const duration = Date.now() - startTime;

    console.log(`✅ First chunk uploaded successfully in ${duration}ms\n`);
    return true;
  } catch (error) {
    console.error('❌ Chunk upload failed:', error);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 TikTok Publish Testing Script\n');
  console.log('=' .repeat(60));
  console.log();

  // Test 1: Check connection
  const connection = await testTikTokConnection();
  if (!connection) {
    console.log('\n❌ Tests failed at connection check');
    process.exit(1);
  }

  // Test 2: Validate token
  const tokenValid = await testTokenValidity(connection);
  if (!tokenValid) {
    console.log('\n❌ Tests failed at token validation');
    process.exit(1);
  }

  // Test 3: Download video (you need to provide a history ID)
  const historyId = process.argv[2];
  if (!historyId) {
    console.log('⚠️  No history ID provided. Skipping video tests.');
    console.log('   Usage: npx tsx scripts/test-tiktok-publish.ts <history-id>');
    console.log('\n✅ Connection and token tests passed!');
    process.exit(0);
  }

  const videoBuffer = await testVideoDownload(historyId);
  if (!videoBuffer) {
    console.log('\n❌ Tests failed at video download');
    process.exit(1);
  }

  // Test 4: Init TikTok upload
  const initData = await testTikTokInit(connection, videoBuffer, 'Test Video from Script');
  if (!initData) {
    console.log('\n❌ Tests failed at TikTok init');
    process.exit(1);
  }

  // Test 5: Upload first chunk
  const uploadSuccess = await testChunkUpload(initData.upload_url, videoBuffer);
  if (!uploadSuccess) {
    console.log('\n❌ Tests failed at chunk upload');
    process.exit(1);
  }

  console.log('=' .repeat(60));
  console.log('\n✅ All tests passed!\n');
  console.log('⚠️  Note: We only tested the first chunk to avoid creating incomplete uploads.');
  console.log('   Full upload should be tested via the actual API endpoint.');
  console.log();
}

runTests().catch(error => {
  console.error('\n❌ Test script error:', error);
  process.exit(1);
});
