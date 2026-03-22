#!/usr/bin/env node

/**
 * All-in-One Video Download API 测试脚本
 *
 * 测试 https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink
 * 支持多个社交平台的视频下载。
 *
 * 用法：
 *   RAPID_API_KEY=<your_key> node scripts/test-social-video-api.mjs
 *
 * 必须设置环境变量：
 *   RAPID_API_KEY
 */

const API_URL = 'https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink';
const API_KEY = process.env.RAPID_API_KEY;

if (!API_KEY) {
  console.error('❌ 缺少环境变量 RAPID_API_KEY');
  console.error('   用法: RAPID_API_KEY=your_key node scripts/test-social-video-api.mjs');
  process.exit(1);
}

const TEST_URLS = [
  {
    platform: 'TikTok',
    url: 'https://www.tiktok.com/@yanriquetoks/video/7606591777969163550?q=Toplux%20Magnesium%20Complex%208%20Essential%20Magnesium%20Supplement%201000mg&t=17741726223657'
  },
  {
    platform: 'Instagram',
    url: 'https://www.instagram.com/p/DWIr1xqCVkJ/'
  },
  {
    platform: 'YouTube',
    url: 'https://youtu.be/xJNzHLtcGuU'
  },
  {
    platform: 'Facebook',
    url: 'https://www.facebook.com/reel/1979407479288888'
  }
];

async function testUrl(platform, url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📱 测试平台: ${platform}`);
  console.log(`🔗 URL: ${url}`);
  console.log('='.repeat(60));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com'
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`📊 HTTP 状态: ${response.status} ${response.statusText}`);

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log('⚠️  响应不是 JSON:');
      console.log(text.slice(0, 500));
      return;
    }

    if (!response.ok) {
      console.log('❌ 请求失败，响应数据:');
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log('✅ 请求成功！');
    console.log('\n📦 响应结构（顶层 keys）:', Object.keys(data));

    // 分析响应，找视频 URL
    const videoUrl = extractVideoUrl(data);
    if (videoUrl) {
      console.log(`\n🎬 找到视频 URL: ${videoUrl.slice(0, 100)}...`);
    } else {
      console.log('\n⚠️  未能自动识别视频 URL，完整响应：');
      console.log(JSON.stringify(data, null, 2).slice(0, 2000));
    }

    // 打印关键字段
    analyzeResponse(data);

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('❌ 请求超时（20秒）');
    } else {
      console.log(`❌ 请求错误: ${error.message}`);
    }
  }
}

function extractVideoUrl(data) {
  // 尝试常见的响应结构
  if (typeof data === 'object' && data !== null) {
    // 直接字段
    if (typeof data.url === 'string') return data.url;
    if (typeof data.play === 'string') return data.play;
    if (typeof data.video_url === 'string') return data.video_url;
    if (typeof data.download_url === 'string') return data.download_url;

    // 嵌套在 data 字段
    if (data.data) {
      const d = data.data;
      if (typeof d.url === 'string') return d.url;
      if (typeof d.play === 'string') return d.play;
      if (typeof d.video_url === 'string') return d.video_url;

      // 数组
      if (Array.isArray(d)) {
        for (const item of d) {
          if (typeof item.url === 'string') return item.url;
          if (typeof item.play === 'string') return item.play;
          if (item.medias && Array.isArray(item.medias)) {
            for (const media of item.medias) {
              if (typeof media.url === 'string') return media.url;
            }
          }
        }
      }

      // medias 数组
      if (Array.isArray(d.medias)) {
        const videoMedia = d.medias.find(m => m.type === 'video' || !m.type);
        if (videoMedia?.url) return videoMedia.url;
      }
    }

    // medias 在顶层
    if (Array.isArray(data.medias)) {
      const videoMedia = data.medias.find(m => m.type === 'video' || !m.type);
      if (videoMedia?.url) return videoMedia.url;
    }

    // links 数组
    if (Array.isArray(data.links)) {
      const videoLink = data.links.find(l => l.type === 'video' || !l.type);
      if (videoLink?.url) return videoLink.url;
    }
  }
  return null;
}

function analyzeResponse(data) {
  console.log('\n🔍 字段分析：');

  const analyze = (obj, prefix = '', depth = 0) => {
    if (depth > 3) return;
    if (!obj || typeof obj !== 'object') return;

    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'string') {
        const display = val.length > 80 ? val.slice(0, 80) + '...' : val;
        const isUrl = val.startsWith('http');
        console.log(`  ${isUrl ? '🔗' : '📝'} ${path}: "${display}"`);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        console.log(`  📊 ${path}: ${val}`);
      } else if (Array.isArray(val)) {
        console.log(`  📋 ${path}: Array[${val.length}]`);
        if (val.length > 0 && typeof val[0] === 'object') {
          analyze(val[0], `${path}[0]`, depth + 1);
        }
      } else if (val && typeof val === 'object') {
        console.log(`  📦 ${path}: Object{${Object.keys(val).join(', ')}}`);
        if (depth < 2) {
          analyze(val, path, depth + 1);
        }
      }
    }
  };

  analyze(data);
}

async function main() {
  console.log('🚀 All-in-One Video Download API 测试');
  console.log(`📡 API: ${API_URL}`);
  console.log(`🔑 API Key: ${API_KEY.slice(0, 8)}...`);

  for (const { platform, url } of TEST_URLS) {
    await testUrl(platform, url);
    // 测试间隔避免频率限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 测试完成');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
