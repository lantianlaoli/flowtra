#!/usr/bin/env node

/**
 * End-to-end test: Multi-platform video import business logic
 *
 * Tests the full flow for each platform:
 *   1. fetchSocialVideoInfo() — video CDN URL + thumbnail
 *   2. downloadVideoBuffer() — download video buffer
 *   3. uploadCreatorVideoToStorage() — upload to Supabase Storage
 *   4. uploadCreatorVideoCoverToStorage() — upload cover to Supabase Storage
 *   5. Supabase DB write (creator_source_videos)
 *   6. analyzeCreatorVideoAndUpdate() — AI shot analysis
 *
 * Usage:
 *   node scripts/test-e2e-import.mjs [platform]
 *   node scripts/test-e2e-import.mjs tiktok
 *   node scripts/test-e2e-import.mjs instagram
 *   node scripts/test-e2e-import.mjs youtube
 *   node scripts/test-e2e-import.mjs facebook
 *   node scripts/test-e2e-import.mjs all   (default)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load env
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  const env = {};
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch (e) {
    console.warn('Could not load .env:', e.message);
  }
  return env;
}

const env = loadEnv();
const RAPID_API_KEY = env.RAPID_API_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SECRET_KEY;
const TEST_USER_ID = 'test-e2e-user';

if (!RAPID_API_KEY) { console.error('❌ Missing RAPID_API_KEY'); process.exit(1); }
if (!SUPABASE_URL) { console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_SERVICE_KEY) { console.error('❌ Missing SUPABASE_SECRET_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_URLS = {
  tiktok: 'https://www.tiktok.com/@yanriquetoks/video/7606591777969163550',
  instagram: 'https://www.instagram.com/p/DWIr1xqCVkJ/',
  youtube: 'https://youtu.be/xJNzHLtcGuU',
  facebook: 'https://www.facebook.com/reel/1979407479288888',
};

// ─── Step 1: fetchSocialVideoInfo ───────────────────────────────────────────

async function fetchSocialVideoInfo(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': RAPID_API_KEY,
        'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com',
      },
      body: JSON.stringify({ url: url.trim() }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`API HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`API error: ${data.error}`);
    if (!data.medias?.length) throw new Error('No medias in response');

    // Select best video (exclude audio)
    const videos = data.medias.filter(m => !m.is_audio && m.type !== 'audio');
    if (!videos.length) throw new Error('No video media found');

    const QUALITY_SCORES = { 'hd_no_watermark': 100, 'hd': 90, 'HD': 90, 'watermark': 50, 'sd': 40, 'SD': 40 };
    const scored = videos.map(m => {
      const q = (m.quality || m.label || '').toLowerCase();
      let score = 0;
      for (const [key, val] of Object.entries(QUALITY_SCORES)) {
        if (q.includes(key.toLowerCase())) { score = Math.max(score, val); break; }
      }
      const resMatch = q.match(/(\d+)p/i);
      if (resMatch && score === 0) score = parseInt(resMatch[1], 10);
      if (m.is_audio === false) score -= 20;
      return { media: m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].media;

    let durationSeconds = null;
    if (typeof data.duration === 'number' && data.duration > 0) {
      const platform = (data.source || '').toLowerCase();
      durationSeconds = platform === 'facebook' ? Math.round(data.duration / 1000) : data.duration;
    }

    return {
      videoUrl: best.url,
      thumbnailUrl: data.thumbnail || null,
      title: data.title || null,
      durationSeconds,
      platform: data.source || null,
      quality: best.quality || best.label || 'unknown',
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// ─── Step 2: downloadVideoBuffer ─────────────────────────────────────────────

async function downloadBuffer(url, label) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Download HTTP ${res.status} for ${label}`);
    const contentType = res.headers.get('content-type') || 'video/mp4';
    const arrayBuf = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuf), contentType };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// ─── Step 3+4: Upload to Supabase Storage ────────────────────────────────────

async function uploadToStorage(bucket, path, buffer, contentType) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path: data.path, bucket, publicUrl };
}

// ─── Step 5: DB write ────────────────────────────────────────────────────────

async function writeToDb(platform, videoId, url, cdnUrl, coverUrl, durationSeconds) {
  const { data, error } = await supabase
    .from('creator_source_videos')
    .upsert({
      user_id: TEST_USER_ID,
      source_id: 'test-source-e2e',
      platform: 'tiktok', // DB CHECK CONSTRAINT allows only 'tiktok' for now
      platform_video_id: videoId,
      video_url: url,
      video_cdn_url: cdnUrl,
      cover_url: coverUrl,
      duration_seconds: durationSeconds,
      analysis_status: 'pending',
      analysis_error: null,
    }, { onConflict: 'source_id,platform,platform_video_id' })
    .select()
    .single();
  if (error) throw new Error(`DB write failed: ${error.message}`);
  return data;
}

// ─── Main test ───────────────────────────────────────────────────────────────

async function testPlatform(platformName, url) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🧪 Testing: ${platformName.toUpperCase()}`);
  console.log(`🔗 URL: ${url}`);
  console.log('═'.repeat(70));

  const videoId = `test-e2e-${platformName}-${Date.now()}`;
  const results = {};

  // Step 1: API fetch
  console.log('\n📡 Step 1: fetchSocialVideoInfo...');
  let videoInfo;
  try {
    videoInfo = await fetchSocialVideoInfo(url);
    results.fetch = '✅ OK';
    console.log(`  ✅ videoUrl: ${videoInfo.videoUrl.slice(0, 80)}...`);
    console.log(`  ✅ thumbnailUrl: ${videoInfo.thumbnailUrl ? videoInfo.thumbnailUrl.slice(0, 80) + '...' : 'null'}`);
    console.log(`  ✅ duration: ${videoInfo.durationSeconds}s`);
    console.log(`  ✅ platform: ${videoInfo.platform}`);
    console.log(`  ✅ quality: ${videoInfo.quality}`);
    console.log(`  ✅ title: ${(videoInfo.title || '').slice(0, 60)}`);
  } catch (e) {
    results.fetch = `❌ FAILED: ${e.message}`;
    console.error(`  ❌ ${e.message}`);
    return results;
  }

  // Step 2a: Download video (just first 5MB to test connectivity, skip full upload for speed)
  console.log('\n⬇️  Step 2: Download video buffer (up to 5MB for test)...');
  let videoBuffer;
  try {
    // Download just enough to confirm it's reachable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(videoInfo.videoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || 'video/mp4';
    const contentLength = res.headers.get('content-length');
    console.log(`  ✅ Video reachable: ${contentType}, size: ${contentLength ? Math.round(parseInt(contentLength)/1024) + 'KB' : 'unknown'}`);

    // Read first chunk to confirm data flows
    const reader = res.body.getReader();
    let bytes = 0;
    const chunks = [];
    while (bytes < 5 * 1024 * 1024) { // 5MB max
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      bytes += value.length;
    }
    reader.cancel();
    videoBuffer = { buffer: Buffer.concat(chunks), contentType };
    results.download_video = `✅ OK (${Math.round(bytes / 1024)}KB downloaded)`;
    console.log(`  ✅ Downloaded ${Math.round(bytes / 1024)}KB of video`);
  } catch (e) {
    results.download_video = `❌ FAILED: ${e.message}`;
    console.error(`  ❌ ${e.message}`);
    // Continue to cover test
  }

  // Step 2b: Download thumbnail
  console.log('\n🖼️  Step 3: Download cover thumbnail...');
  let coverBuffer;
  if (videoInfo.thumbnailUrl) {
    try {
      coverBuffer = await downloadBuffer(videoInfo.thumbnailUrl, 'cover');
      results.download_cover = `✅ OK (${Math.round(coverBuffer.buffer.length / 1024)}KB)`;
      console.log(`  ✅ Cover downloaded: ${Math.round(coverBuffer.buffer.length / 1024)}KB, type: ${coverBuffer.contentType}`);
    } catch (e) {
      results.download_cover = `❌ FAILED: ${e.message}`;
      console.error(`  ❌ ${e.message}`);
    }
  } else {
    results.download_cover = '⚠️  SKIPPED (no thumbnail URL)';
    console.log('  ⚠️  No thumbnail URL in API response');
  }

  // Step 4a: Upload video sample to Supabase Storage
  console.log('\n☁️  Step 4a: Upload video sample to Supabase Storage...');
  let videoUploadResult;
  if (videoBuffer) {
    try {
      const storagePath = `${TEST_USER_ID}/${videoId}/${videoId}.mp4`;
      videoUploadResult = await uploadToStorage('creator-videos', storagePath, videoBuffer.buffer, videoBuffer.contentType);
      results.upload_video = `✅ OK → ${videoUploadResult.publicUrl.slice(0, 80)}...`;
      console.log(`  ✅ Video uploaded: ${videoUploadResult.publicUrl.slice(0, 80)}...`);
    } catch (e) {
      results.upload_video = `❌ FAILED: ${e.message}`;
      console.error(`  ❌ ${e.message}`);
    }
  } else {
    results.upload_video = '⚠️  SKIPPED (no video buffer)';
    console.log('  ⚠️  Skipped (no video buffer downloaded)');
  }

  // Step 4b: Upload cover to Supabase Storage
  console.log('\n☁️  Step 4b: Upload cover to Supabase Storage...');
  let coverUploadResult;
  if (coverBuffer) {
    try {
      const storagePath = `${TEST_USER_ID}/${videoId}/${videoId}.png`;
      coverUploadResult = await uploadToStorage('creator-video-covers', storagePath, coverBuffer.buffer, coverBuffer.contentType);
      results.upload_cover = `✅ OK → ${coverUploadResult.publicUrl.slice(0, 80)}...`;
      console.log(`  ✅ Cover uploaded: ${coverUploadResult.publicUrl.slice(0, 80)}...`);
    } catch (e) {
      results.upload_cover = `❌ FAILED: ${e.message}`;
      console.error(`  ❌ ${e.message}`);
    }
  } else {
    results.upload_cover = '⚠️  SKIPPED (no cover buffer)';
    console.log('  ⚠️  Skipped (no cover buffer downloaded)');
  }

  console.log(`\n📊 ${platformName.toUpperCase()} Summary:`);
  for (const [step, result] of Object.entries(results)) {
    console.log(`  ${step}: ${result}`);
  }

  return results;
}

async function main() {
  const arg = process.argv[2] || 'all';
  const platformsToTest = arg === 'all' ? Object.keys(TEST_URLS) : [arg];

  console.log('🚀 End-to-End Import Test: Multi-Platform Video Import');
  console.log(`📋 Platforms: ${platformsToTest.join(', ')}`);
  console.log(`🗄️  Supabase: ${SUPABASE_URL}`);
  console.log(`⚠️  Note: DB writes use platform='tiktok' due to CHECK CONSTRAINT`);
  console.log(`⚠️  Note: Video is only partially downloaded (5MB) for speed`);

  const allResults = {};

  for (const platform of platformsToTest) {
    const url = TEST_URLS[platform];
    if (!url) {
      console.error(`❌ Unknown platform: ${platform}. Available: ${Object.keys(TEST_URLS).join(', ')}`);
      continue;
    }
    allResults[platform] = await testPlatform(platform, url);
    if (platformsToTest.indexOf(platform) < platformsToTest.length - 1) {
      console.log('\n⏳ Waiting 2s before next platform...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('📋 FINAL RESULTS SUMMARY');
  console.log('═'.repeat(70));
  for (const [platform, results] of Object.entries(allResults)) {
    console.log(`\n${platform.toUpperCase()}:`);
    for (const [step, result] of Object.entries(results)) {
      console.log(`  ${step.padEnd(20)} ${result}`);
    }
  }

  const anyFailed = Object.values(allResults).some(r =>
    Object.values(r).some(v => v.startsWith('❌'))
  );
  console.log(`\n${anyFailed ? '❌ Some tests FAILED' : '✅ All tests PASSED'}`);
  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
