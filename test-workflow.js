const fs = require('fs');

// Read environment variables from .env file
function loadEnvVars() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const firstEqualIndex = line.indexOf('=');
        if (firstEqualIndex !== -1) {
          const key = line.substring(0, firstEqualIndex).trim();
          const value = line.substring(firstEqualIndex + 1).trim();
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return {};
  }
}

const envVars = loadEnvVars();

// Test the character ads workflow
async function testCharacterAdsWorkflow() {
  try {
    console.log('Testing Character Ads Workflow...');
    
    // Create a new project
    const createResponse = await fetch('http://localhost:3000/api/character-ads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${envVars.CLERK_SECRET_KEY}` // If needed
      },
      body: JSON.stringify({
        person_image_urls: [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
        ],
        product_image_urls: [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop"
        ],
        video_duration_seconds: 10,
        image_model: "flux-dev",
        video_model: "kling"
      })
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create project: ${createResponse.status} ${createResponse.statusText}`);
    }
    
    const project = await createResponse.json();
    console.log('Created project:', project.id);
    
    // Monitor project status
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`http://localhost:3000/api/character-ads/${project.id}/status`);
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to get status: ${statusResponse.status}`);
      }
      
      const status = await statusResponse.json();
      console.log(`Attempt ${attempts + 1}: Status = ${status.status}, Step = ${status.current_step}, Progress = ${status.progress_percentage}%`);
      
      if (status.status === 'completed') {
        console.log('✅ Workflow completed successfully!');
        console.log('Merged video URL:', status.merged_video_url);
        
        // Check scenes table
        console.log('\nChecking scenes...');
        // This would require direct database access or an API endpoint
        break;
      } else if (status.status === 'failed') {
        console.log('❌ Workflow failed:', status.error_message);
        break;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    if (attempts >= maxAttempts) {
      console.log('⏰ Test timed out after 5 minutes');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCharacterAdsWorkflow();