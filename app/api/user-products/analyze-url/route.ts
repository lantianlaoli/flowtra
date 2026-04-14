import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { extractOpenRouterJsonContent, sendOpenRouterChat } from '@/lib/openrouter';

const MODEL = process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.0-flash-lite';

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

  const data = await sendOpenRouterChat(payload, {
    maxRetries: 3,
    timeoutMs: 20000
  });
  const content = data?.choices?.[0]?.message?.content;

  interface ProductMetadataSchema {
    product_name: string;
  }

  const isProductMetadata = (value: unknown): value is ProductMetadataSchema => {
    return Boolean(
      value &&
      typeof (value as { product_name?: unknown }).product_name === 'string'
    );
  };

  const parsed = extractOpenRouterJsonContent<ProductMetadataSchema>(content);

  if (!isProductMetadata(parsed)) {
    console.error('[analyze-url] Unexpected AI response for product metadata:', data);
    throw new Error('Invalid response from product analyzer');
  }

  return {
    productName: parsed.product_name.trim()
  };
}
