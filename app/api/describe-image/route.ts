import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { httpRequestWithRetry } from '@/lib/httpRequest';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    const visionModel = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-lite-001';

    const requestBody = JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe the product and brand in this image in full detail. Fully ignore the background. Focus ONLY on the product.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    let data: { choices: Array<{ message: { content: string } }> };

    try {
      // Try fetch first
      const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Flowtra',
          'User-Agent': 'Flowtra/1.0'
        },
        body: requestBody
      }, 2, 10000); // 2 retries, 10 second timeout

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenRouter API error:', response.status, errorData);
        return NextResponse.json(
          { error: 'Failed to describe image', details: errorData },
          { status: response.status }
        );
      }

      data = await response.json();
    } catch (fetchError) {
      console.warn('Fetch failed, trying native HTTPS:', fetchError);
      
      // Fallback to native HTTPS
      try {
        const result = await httpRequestWithRetry('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'Flowtra',
            'User-Agent': 'Flowtra/1.0'
          },
          body: requestBody
        }, 2);

        if (result.status !== 200) {
          console.error('OpenRouter API error (native):', result.status, result.data);
          return NextResponse.json(
            { error: 'Failed to describe image', details: result.data },
            { status: result.status }
          );
        }

        data = JSON.parse(result.data);
      } catch (nativeError) {
        console.error('Both fetch and native HTTPS failed:', nativeError);
        throw fetchError; // Throw original error for consistent handling
      }
    }

    const description = data.choices[0]?.message?.content || 'No description generated';

    return NextResponse.json({
      success: true,
      description
    });
  } catch (error) {
    console.error('Image description error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}