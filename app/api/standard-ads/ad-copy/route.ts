import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';

interface AdCopyRequestPayload {
  productName?: string;
  productDescription?: string;
  productImageUrls?: string[];
}

// Use vision-capable model when images are provided
const FALLBACK_TEXT_MODEL =
  process.env.OPENROUTER_AD_COPY_MODEL ||
  process.env.OPENROUTER_MODEL ||
  'openai/gpt-4o-mini';

const VISION_MODEL = 'google/gemini-2.5-flash-preview-09-2025'; // Vision-capable model with structured output

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as AdCopyRequestPayload;
    const { productName, productDescription, productImageUrls = [] } = body;

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
      productDescription?.trim() || 'A modern product with strong customer appeal.';
    const nameSnippet = productName?.trim() || 'the product';

    const systemPrompt = `You are a performance marketing copywriter. Create ONE short, punchy ad copy headline (6-12 words) that drives conversions. Return ONLY the headline text, nothing else. No introductions, no bullet points, no lists. Just the headline. Avoid emojis, hashtags, and all caps. Focus on clarity, benefit, and urgency.`;

    // Build user message content with images if available
    const userContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: `Product Name: ${nameSnippet}\nProduct Description: ${descriptionSnippet}\n\nAnalyze the product ${cleanedImageUrls.length > 0 ? 'images' : ''} and create ONE compelling ad copy headline that highlights key features and benefits. Return ONLY the headline text.`
      }
    ];

    // Add images to content if available
    for (const imageUrl of cleanedImageUrls) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    // Use vision model if images are provided, otherwise use text model
    const selectedModel = cleanedImageUrls.length > 0 ? VISION_MODEL : FALLBACK_TEXT_MODEL;

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
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          max_tokens: 120,
          temperature: 0.6
        })
      },
      3,
      45000
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = errorPayload?.error || response.statusText || 'Failed to generate ad copy.';
      return NextResponse.json(
        { error: message },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();
    const messageContent = data?.choices?.[0]?.message?.content;

    let rawContent: string | undefined;
    if (Array.isArray(messageContent)) {
      const textItem = messageContent.find((item) => item?.type === 'text' && typeof item.text === 'string');
      rawContent = textItem?.text;
    } else if (typeof messageContent === 'string') {
      rawContent = messageContent;
    } else if (messageContent && typeof messageContent === 'object' && 'text' in messageContent && typeof messageContent.text === 'string') {
      rawContent = messageContent.text;
    }

    if (!rawContent) {
      return NextResponse.json(
        { error: 'No ad copy returned from OpenRouter.' },
        { status: 502 }
      );
    }

    // Clean up the response - remove markdown, code blocks, and common prefixes
    let cleanedContent = rawContent
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim();

    // Remove common AI response patterns
    cleanedContent = cleanedContent
      .replace(/^Here (?:are|is).*?:?\s*/i, '') // "Here are some ad copy headlines:"
      .replace(/^(?:Ad copy|Headline|Tagline)s?:?\s*/i, '') // "Ad copy:", "Headlines:"
      .replace(/^\*+\s*/gm, '') // Remove bullet points/asterisks at line start
      .replace(/^[-•]\s*/gm, '') // Remove list markers
      .replace(/^\d+\.\s*/gm, '') // Remove numbered lists
      .split('\n')[0] // Take only the first line
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Remove surrounding quotes if present
    cleanedContent = cleanedContent.replace(/^["']|["']$/g, '');

    const headline = cleanedContent.length > 120
      ? cleanedContent.slice(0, 117).trimEnd() + '…'
      : cleanedContent;

    return NextResponse.json({ success: true, adCopy: headline });
  } catch (error) {
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error || 'Failed to generate ad copy.', details: networkError.details },
      { status: networkError.status || 500 }
    );
  }
}
