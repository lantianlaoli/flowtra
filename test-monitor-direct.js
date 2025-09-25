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

async function testMonitorDirect() {
  console.log('=== 直接测试监控任务API ===');
  
  try {
    const response = await fetch('http://localhost:3000/api/character-ads/monitor-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('响应状态:', response.status, response.statusText);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('响应内容 (原始):', responseText);
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log('响应内容 (JSON):', responseJson);
    } catch (parseError) {
      console.log('无法解析为JSON:', parseError.message);
    }
    
  } catch (error) {
    console.error('请求失败:', error);
  }
}

testMonitorDirect();