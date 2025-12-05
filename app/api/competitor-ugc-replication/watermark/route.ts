import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';

interface WatermarkRequestPayload {
  productName?: string;
  productDescription?: string;
  productImageUrls?: string[];
  language?: LanguageCode;
}

const WATERMARK_LOCATIONS = ['bottom left', 'bottom right', 'top left', 'top right', 'center bottom'] as const;

// Use unified model for both text and vision tasks
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

const cleanMarkdown = (raw: string) =>
  raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

const normaliseLocation = (value: string | undefined) => {
  if (!value) return 'bottom left';
  const lower = value.toLowerCase().trim();
  return WATERMARK_LOCATIONS.find((loc) => loc === lower) || 'bottom left';
};

const parseStructured = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return { text: undefined, location: undefined };
  const candidate = payload as { watermarkText?: unknown; watermarkLocation?: unknown };
  const text = typeof candidate.watermarkText === 'string' ? candidate.watermarkText : undefined;
  const location = typeof candidate.watermarkLocation === 'string' ? candidate.watermarkLocation : undefined;
  return { text, location };
};

const parseFromString = (raw: string) => {
  const cleaned = cleanMarkdown(raw);
  try {
    return parseStructured(JSON.parse(cleaned));
  } catch {
    const textMatch = cleaned.match(/"?watermarkText"?\s*:?\s*"([^"]+)"/i);
    const locationMatch = cleaned.match(/"?watermarkLocation"?\s*:?\s*"([^"]+)"/i);
    return {
      text: textMatch ? textMatch[1] : undefined,
      location: locationMatch ? locationMatch[1] : undefined
    };
  }
};

const extractFromContent = (content: unknown) => {
  if (Array.isArray(content)) {
    for (const entry of content) {
      if (entry && typeof entry === 'object') {
        if ('json' in entry && entry.json) {
          const parsed = parseStructured(entry.json as Record<string, unknown>);
          if (parsed.text || parsed.location) return parsed;
        }
        if ('text' in entry && typeof (entry as { text?: unknown }).text === 'string') {
          const parsed = parseFromString((entry as { text: string }).text);
          if (parsed.text || parsed.location) return parsed;
        }
      }
    }
    return { text: undefined, location: undefined };
  }

  if (typeof content === 'string') {
    return parseFromString(content);
  }

  if (content && typeof content === 'object') {
    if ('json' in content && (content as { json?: unknown }).json) {
      const parsed = parseStructured((content as { json: unknown }).json);
      if (parsed.text || parsed.location) return parsed;
    }
    return parseStructured(content);
  }

  return { text: undefined, location: undefined };
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as WatermarkRequestPayload;
    const { productName, productDescription, productImageUrls = [], language = 'en' } = body;

    const cleanedImageUrls = productImageUrls
      .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 3);

    if (!productName && !productDescription && cleanedImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Provide at least a product name, description, or image.' },
        { status: 400 }
      );
    }

    const descriptionSnippet =
      productDescription?.trim() || 'A modern product that needs a tasteful watermark.';
    const nameSnippet = productName?.trim() || 'the product';
    const languageName = getLanguagePromptName(language);

    const systemPrompt = `You are a brand design assistant. Analyze product images to identify brand names, logos, or text visible on the product/packaging. Suggest concise watermark text (≤ 4 words) in ${languageName} based on what you see in the image, and recommend optimal placement for a product advertisement. The watermark text MUST be written in ${languageName}. Consider logo visibility, background contrast, and visual balance. Respond in strict JSON format.`;

    // Build user message content with images if available
    const userContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: `Product Name: ${nameSnippet}\nProduct Description: ${descriptionSnippet}\n\n${cleanedImageUrls.length > 0 ? 'Analyze the product images carefully. Look for any brand names, logos, or text visible on the product or packaging. Extract the brand name if visible.' : 'No product visuals provided.'}\n\nReturn JSON with keys "watermarkText" (in ${languageName}) and "watermarkLocation". The watermarkText MUST be in ${languageName}. Location must be one of: ${WATERMARK_LOCATIONS.join(', ')}.`
      }
    ];

    // Add images to content if available
    for (const imageUrl of cleanedImageUrls) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    const response = await fetchWithRetry(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Flowtra'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          max_tokens: 150,
          temperature: 0.5,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'watermark_suggestion',
              strict: true,
              schema: {
                type: 'object',
                required: ['watermarkText', 'watermarkLocation'],
                properties: {
                  watermarkText: {
                    type: 'string',
                    description: 'Concise watermark text (4 words or less), extracted from product images if visible'
                  },
                  watermarkLocation: {
                    type: 'string',
                    description: 'Optimal watermark placement location',
                    enum: ['bottom left', 'bottom right', 'top left', 'top right', 'center bottom']
                  }
                },
                additionalProperties: false
              }
            }
          }
        })
      },
      3,
      45000
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = errorPayload?.error || response.statusText || 'Failed to suggest watermark.';
      return NextResponse.json(
        { error: message },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();
    const { text, location } = extractFromContent(data?.choices?.[0]?.message?.content);

    const normalizedLocation = normaliseLocation(location);
    const finalText = (text || '').trim().slice(0, 32) || (productName?.trim() || '');

    return NextResponse.json({
      success: true,
      text: finalText,
      location: normalizedLocation
    });
  } catch (error) {
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error || 'Failed to suggest watermark.', details: networkError.details },
      { status: networkError.status || 500 }
    );
  }
}
