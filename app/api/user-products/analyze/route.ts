import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadProductPhotoToStorage, deleteProductPhotoFromStorage } from '@/lib/supabase';
import { validateImageFormat } from '@/lib/image-validation';
import { extractAIGatewayJsonContent, sendAIGatewayChat } from '@/lib/ai-gateway';

const MODEL = process.env.AI_GATEWAY_MODEL || 'google/gemini-2.0-flash-lite';

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

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const uploadResult = await uploadProductPhotoToStorage(file, userId);

    try {
      const metadata = await analyzeProductImage(uploadResult.publicUrl);
      return NextResponse.json({ success: true, ...metadata });
    } finally {
      await deleteProductPhotoFromStorage({
        bucket: uploadResult.bucket,
        path: uploadResult.path,
        photoUrl: uploadResult.publicUrl
      }).catch(error => {
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

  const data = await sendAIGatewayChat(payload, {
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

  const parsed = extractAIGatewayJsonContent<ProductMetadataSchema>(content);

  if (!isProductMetadata(parsed)) {
    console.error('Unexpected AI response for product metadata:', data);
    throw new Error('Invalid response from product analyzer');
  }

  return {
    productName: parsed.product_name.trim()
  };
}
