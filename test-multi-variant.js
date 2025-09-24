// 使用内置的 fetch (Node.js 18+)

async function testMultiVariantAds() {
  const testData = {
    imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=600&fit=crop",
    userId: "test-user-123",
    elementsCount: 2,
    adCopy: "Test ad copy",
    imageModel: "auto",
    imageSize: "1024x1024",
    photoOnly: true,
    videoModel: "veo3_fast",
    generateVideo: false
  };

  try {
    console.log('Testing multi-variant ads creation...');
    console.log('Request data:', JSON.stringify(testData, null, 2));

    const response = await fetch('http://localhost:3001/api/multi-variant-ads/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Success! Project ID:', result.projectId);
    } else {
      console.log('❌ Failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMultiVariantAds();