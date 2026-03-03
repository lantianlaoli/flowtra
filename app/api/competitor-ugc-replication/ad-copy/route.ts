import { NextRequest, NextResponse } from 'next/server';
import { getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';

interface AdCopyRequestPayload {
  productName?: string;
  productImageUrls?: string[];
  language?: LanguageCode;
}

// Use unified model for both text and vision tasks
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as AdCopyRequestPayload;
    const { productName, productImageUrls = [], language = 'en' } = body;

    const cleanedImageUrls = productImageUrls
      .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 3);

    if (!productName && cleanedImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Provide at least a product name or image.' },
        { status: 400 }
      );
    }

    const nameSnippet = productName?.trim() || 'the product';
    const languageName = getLanguagePromptName(language);

    const systemPrompt = `You are a performance marketing copywriter. Create ONE short, punchy ad copy headline (6-12 words) that drives conversions. The headline MUST be written in ${languageName}. Return ONLY the headline text in ${languageName}, nothing else. No introductions, no bullet points, no lists. Just the headline. Avoid emojis, hashtags, and all caps. Focus on clarity, benefit, and urgency.`;

    // Build user message content with images if available
    const userContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: `Product Name: ${nameSnippet}\n\nAnalyze the product ${cleanedImageUrls.length > 0 ? 'images' : ''} and create ONE compelling ad copy headline that highlights key features and benefits. The headline MUST be written in ${languageName}. Return ONLY the headline text in ${languageName}.`
      }
    ];

    // Add images to content if available
    for (const imageUrl of cleanedImageUrls) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    const data = await sendOpenRouterChat({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 120,
      temperature: 0.6
    }, {
      maxRetries: 3,
      timeoutMs: 45000,
      httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      xTitle: 'Flowtra'
    });

    const rawContent = extractOpenRouterTextContent(data?.choices?.[0]?.message?.content) ?? undefined;

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
