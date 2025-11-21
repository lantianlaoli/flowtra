import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadProductPhotoToStorage, deleteProductPhotoFromStorage } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Product photo is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 });
    }

    const uploadResult = await uploadProductPhotoToStorage(file, userId);

    try {
      const metadata = await analyzeProductImage(uploadResult.publicUrl);
      return NextResponse.json({ success: true, ...metadata });
    } finally {
      await deleteProductPhotoFromStorage(uploadResult.publicUrl).catch(error => {
        console.warn('[user-products/analyze] Failed to delete temporary asset:', error);
      });
    }
  } catch (error) {
    console.error('POST /api/user-products/analyze error:', error);
    return NextResponse.json({
      error: 'Failed to analyze product photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function analyzeProductImage(imageUrl: string): Promise<{ productName: string; productDetails: string }> {
  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'product_metadata',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['product_name', 'product_details'],
        properties: {
          product_name: {
            type: 'string',
            description: 'Merchandisable product name (max 80 characters)'
          },
          product_details: {
            type: 'string',
            description: 'Compelling product description (2-3 short sentences)'
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
            text: 'Analyze this product photo and respond with JSON containing product_name and product_details. The name should feel like a polished SKU title and product_details should be 2-3 short sentences highlighting key features and materials.'
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
    product_details: string;
  }

  const isProductMetadata = (value: unknown): value is ProductMetadataSchema => {
    return Boolean(
      value &&
      typeof (value as { product_name?: unknown }).product_name === 'string' &&
      typeof (value as { product_details?: unknown }).product_details === 'string'
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
    console.error('Failed to parse product metadata JSON:', error);
    parsed = undefined;
  }

  if (!isProductMetadata(parsed)) {
    console.error('Unexpected AI response for product metadata:', data);
    throw new Error('Invalid response from product analyzer');
  }

  return {
    productName: parsed.product_name.trim(),
    productDetails: parsed.product_details.trim()
  };
}
