import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get image URL from request body
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({
        error: 'Image URL is required'
      }, { status: 400 });
    }

    // 3. Analyze product image by URL
    console.log('[analyze-url] Analyzing image:', { userId, imageUrl });

    const metadata = await analyzeProductImage(imageUrl);

    console.log('[analyze-url] Analysis complete:', { userId, productName: metadata.productName });

    return NextResponse.json({
      success: true,
      ...metadata
    });

  } catch (error) {
    console.error('[analyze-url] POST error:', error);
    return NextResponse.json({
      error: 'Failed to analyze product photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function analyzeProductImage(imageUrl: string): Promise<{ productName: string }> {
  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'product_metadata',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['product_name'],
        properties: {
          product_name: {
            type: 'string',
            description: 'Merchandisable product name (max 80 characters)'
          }
        }
      }
    }
  } as const;

  const payload = {
    model: MODEL,
    response_format: responseFormat,
    messages: [
      {
        role: 'system',
        content: 'You are a senior e-commerce merchandiser. Analyze product photos and return concise, human-friendly catalog metadata.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text' as const,
            text: 'Analyze this product photo and respond with JSON containing product_name only. The name should feel like a polished SKU title.'
          },
          {
            type: 'image_url' as const,
            image_url: { url: imageUrl }
          }
        ]
      }
    ]
  };

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, 3, 20000);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Metadata generation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  interface OutputEntry {
    type?: string;
    text?: string;
  }

  interface ProductMetadataSchema {
    product_name: string;
  }

  const isProductMetadata = (value: unknown): value is ProductMetadataSchema => {
    return Boolean(
      value &&
      typeof (value as { product_name?: unknown }).product_name === 'string'
    );
  };

  let parsed: unknown;
  try {
    if (typeof content === 'string') {
      parsed = JSON.parse(content);
    } else if (Array.isArray(content)) {
      const jsonEntry = content.find((entry: OutputEntry) => entry.type === 'output_text');
      parsed = jsonEntry?.text ? JSON.parse(jsonEntry.text) : undefined;
    }
  } catch (error) {
    console.error('[analyze-url] Failed to parse product metadata JSON:', error);
    parsed = undefined;
  }

  if (!isProductMetadata(parsed)) {
    console.error('[analyze-url] Unexpected AI response for product metadata:', data);
    throw new Error('Invalid response from product analyzer');
  }

  return {
    productName: parsed.product_name.trim()
  };
}
