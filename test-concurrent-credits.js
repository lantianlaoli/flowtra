/**
 * Test script to verify concurrent workflow credit deduction fix
 * This script simulates multiple concurrent workflow starts to ensure
 * users cannot exceed their credit limits through race conditions.
 */

const WORKFLOW_ENDPOINT = 'http://localhost:3000/api/workflow/start';
const TEST_USER_ID = 'test_user_concurrent_' + Date.now();
const TEST_IMAGE_URL = 'https://example.com/test-image.jpg';

// Mock user with limited credits for testing
async function simulateConcurrentWorkflows(userCredits = 100, workflowCost = 60, concurrentRequests = 3) {
  console.log('🧪 Testing Concurrent Workflow Credit Deduction');
  console.log(`User Credits: ${userCredits}`);
  console.log(`Workflow Cost: ${workflowCost} credits each`);
  console.log(`Concurrent Requests: ${concurrentRequests}`);
  console.log(`Expected Behavior: Only ${Math.floor(userCredits / workflowCost)} workflows should succeed\n`);

  // Create multiple concurrent requests
  const requests = Array.from({ length: concurrentRequests }, (_, i) => {
    return fetch(WORKFLOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: TEST_IMAGE_URL,
        userId: TEST_USER_ID,
        videoModel: 'veo3_fast' // 60 credits
      })
    });
  });

  console.log('🚀 Sending concurrent requests...\n');
  
  try {
    const responses = await Promise.allSettled(requests);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < responses.length; i++) {
      const result = responses[i];
      
      if (result.status === 'fulfilled') {
        const data = await result.value.json();
        
        if (data.success) {
          successCount++;
          console.log(`✅ Request ${i + 1}: SUCCESS - ${data.message}`);
        } else {
          failureCount++;
          console.log(`❌ Request ${i + 1}: FAILED - ${data.error || data.message}`);
        }
      } else {
        failureCount++;
        console.log(`💥 Request ${i + 1}: NETWORK ERROR - ${result.reason}`);
      }
    }
    
    console.log('\n📊 Results Summary:');
    console.log(`Successful workflows: ${successCount}`);
    console.log(`Failed workflows: ${failureCount}`);
    
    const expectedSuccessful = Math.floor(userCredits / workflowCost);
    
    if (successCount <= expectedSuccessful) {
      console.log('✅ TEST PASSED: Concurrent credit deduction working correctly!');
      return true;
    } else {
      console.log('❌ TEST FAILED: Too many workflows succeeded - race condition detected!');
      return false;
    }
    
  } catch (error) {
    console.error('Test execution error:', error);
    return false;
  }
}

// Instructions for manual testing
console.log(`
⚠️  MANUAL TEST REQUIRED ⚠️

This test requires a running development server and proper setup:

1. Start the development server:
   pnpm dev

2. Ensure you have test user setup in your database
3. Update TEST_USER_ID with a real user ID
4. Update WORKFLOW_ENDPOINT if running on different port
5. Run this script:
   node test-concurrent-credits.js

Expected Results:
- Before fix: Multiple workflows would start even with insufficient credits
- After fix: Only workflows within credit limit should succeed

Note: This is a demonstration script. For production testing, use proper
test framework and mock external API calls.
`);

// Uncomment to run the test (requires server setup)
// simulateConcurrentWorkflows();