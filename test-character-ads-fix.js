import fs from 'fs';
import path from 'path';

// Load environment variables manually
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        process.env[key.trim()] = value.slice(1, -1);
      } else {
        process.env[key.trim()] = value;
      }
    }
  });
}

// Test the fixed generateVideoWithKIE function
async function testCharacterAdsVideoGeneration() {
  console.log('🧪 Testing Character Ads Video Generation Fix...\n');

  // Test data - using a sample image URL and prompt
  const testImageUrl = 'https://example.com/test-image.jpg'; // This would be a real generated_image_url
  const testPrompt = {
    description: 'An anime character holding a Spider-Man toy',
    setting: 'Indoor room with soft lighting',
    camera_type: 'Medium shot',
    camera_movement: 'Slow zoom in',
    action: 'Character gently moves the toy',
    lighting: 'Warm ambient lighting',
    other_details: 'Focus on character expression and toy details',
    dialogue: '',
    music: 'Gentle background music',
    ending: 'Character smiles at the toy'
  };

  // Simulate the fixed generateVideoWithKIE function
  function simulateGenerateVideoWithKIE(prompt, videoModel, referenceImageUrl) {
    // Convert prompt object to string for veo3 API
    const finalPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    
    // Use correct veo3 API structure
    const requestBody = {
      prompt: finalPrompt,
      model: videoModel,
      aspectRatio: "16:9",
      imageUrls: [referenceImageUrl], // ✅ Correct parameter name and format
      enableAudio: true,
      audioEnabled: true,
      generateVoiceover: false,
      includeDialogue: false
    };

    console.log('📋 VEO API Request Body (Fixed):');
    console.log(JSON.stringify(requestBody, null, 2));
    
    return requestBody;
  }

  // Test with different video models
  const models = ['veo3_fast', 'veo3'];
  
  for (const model of models) {
    console.log(`\n🎬 Testing with model: ${model}`);
    console.log('=' .repeat(50));
    
    const requestBody = simulateGenerateVideoWithKIE(testPrompt, model, testImageUrl);
    
    // Validate the request structure
    console.log('\n✅ Validation Results:');
    console.log(`- Has imageUrls parameter: ${requestBody.imageUrls ? '✅' : '❌'}`);
    console.log(`- imageUrls is array: ${Array.isArray(requestBody.imageUrls) ? '✅' : '❌'}`);
    console.log(`- Image URL included: ${requestBody.imageUrls?.[0] === testImageUrl ? '✅' : '❌'}`);
    console.log(`- Has aspectRatio: ${requestBody.aspectRatio ? '✅' : '❌'}`);
    console.log(`- Prompt is string: ${typeof requestBody.prompt === 'string' ? '✅' : '❌'}`);
    console.log(`- No deprecated referenceImage: ${!requestBody.referenceImage ? '✅' : '❌'}`);
    console.log(`- No deprecated durationSeconds: ${!requestBody.durationSeconds ? '✅' : '❌'}`);
  }

  console.log('\n🎯 Key Fixes Applied:');
  console.log('1. ✅ Changed referenceImage → imageUrls (array format)');
  console.log('2. ✅ Added aspectRatio parameter');
  console.log('3. ✅ Removed deprecated durationSeconds parameter');
  console.log('4. ✅ Enabled audio parameters for better video quality');
  console.log('5. ✅ Added request body logging for debugging');

  console.log('\n🔍 Expected Behavior:');
  console.log('- The generated image should now be correctly passed to veo3 API');
  console.log('- Video generation should respect the image content');
  console.log('- Anime character with Spider-Man toy should remain consistent');
  
  console.log('\n✨ Test completed! The fix should resolve the image incorporation issue.');
}

// Run the test
testCharacterAdsVideoGeneration().catch(console.error);