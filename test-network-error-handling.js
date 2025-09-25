#!/usr/bin/env node

// Test script for network error handling in FAL status check
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

// Mock the checkFalTaskStatus function with network error handling
async function checkFalTaskStatus(taskId, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  try {
    // Simulate network error for testing
    if (retryCount < 2) {
      const error = new Error('fetch failed');
      error.cause = { code: 'EAI_AGAIN', hostname: 'queue.fal.run' };
      throw error;
    }

    // Simulate successful response after retries
    return {
      status: 'COMPLETED',
      result_url: 'https://example.com/merged-video.mp4'
    };

  } catch (error) {
    console.error(`fal.ai status check error (attempt ${retryCount + 1}):`, error);
    
    // Check if it's a network-related error and we haven't exceeded max retries
    const isNetworkError = error instanceof Error && (
      error.message.includes('fetch failed') ||
      error.message.includes('EAI_AGAIN') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('timeout')
    );

    if (isNetworkError && retryCount < MAX_RETRIES) {
      console.log(`Network error detected, retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return checkFalTaskStatus(taskId, retryCount + 1);
    }

    // If it's a network error and we've exhausted retries, return a special status
    if (isNetworkError) {
      console.warn(`Network error persists after ${MAX_RETRIES} retries, marking as network_error`);
      return {
        status: 'NETWORK_ERROR',
        error: `Network connectivity issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

console.log('🧪 Testing network error handling...');

async function testNetworkErrorHandling() {
  try {
    console.log('\n📡 Testing FAL status check with simulated network errors...');
    
    const result = await checkFalTaskStatus('test-task-id');
    
    console.log('\n✅ Test completed successfully!');
    console.log('Final result:', JSON.stringify(result, null, 2));
    
    if (result.status === 'COMPLETED') {
      console.log('🎉 Network error handling worked! Task completed after retries.');
    } else if (result.status === 'NETWORK_ERROR') {
      console.log('⚠️  Network error persisted, but handled gracefully.');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Test with persistent network error
async function testPersistentNetworkError() {
  console.log('\n🔄 Testing persistent network error scenario...');
  
  // Mock function that always fails
  async function alwaysFailCheckFalTaskStatus(taskId, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // Shorter delay for testing

    try {
      // Always throw network error
      const error = new Error('fetch failed');
      error.cause = { code: 'EAI_AGAIN', hostname: 'queue.fal.run' };
      throw error;

    } catch (error) {
      console.error(`fal.ai status check error (attempt ${retryCount + 1}):`, error.message);
      
      const isNetworkError = error instanceof Error && (
        error.message.includes('fetch failed') ||
        error.message.includes('EAI_AGAIN') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('timeout')
      );

      if (isNetworkError && retryCount < MAX_RETRIES) {
        console.log(`Network error detected, retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return alwaysFailCheckFalTaskStatus(taskId, retryCount + 1);
      }

      if (isNetworkError) {
        console.warn(`Network error persists after ${MAX_RETRIES} retries, marking as network_error`);
        return {
          status: 'NETWORK_ERROR',
          error: `Network connectivity issue: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }

      throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  try {
    const result = await alwaysFailCheckFalTaskStatus('test-task-id');
    console.log('Persistent error result:', JSON.stringify(result, null, 2));
    
    if (result.status === 'NETWORK_ERROR') {
      console.log('✅ Persistent network error handled correctly!');
    }
  } catch (error) {
    console.error('❌ Persistent error test failed:', error);
  }
}

// Run tests
async function runAllTests() {
  await testNetworkErrorHandling();
  await testPersistentNetworkError();
  console.log('\n🏁 All tests completed!');
}

runAllTests();