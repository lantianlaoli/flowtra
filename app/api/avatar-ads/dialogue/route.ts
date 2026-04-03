import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { clampDialogueToWordLimit, getAvatarAdsDialogueWordLimit } from '@/lib/avatar-ads-dialogue';
import { extractAIGatewayTextContent, sendAIGatewayChat } from '@/lib/ai-gateway';
import { enforceRateLimit, getRequestIp, RateLimitError } from '@/lib/security/rate-limit';

interface DialogueRequestPayload {
  productName?: string;
  productImageUrls?: string[];
  language?: LanguageCode;
  videoDurationSeconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    enforceRateLimit({
      key: `avatar-ads-dialogue:${userId}:${getRequestIp(request)}`,
      limit: 8,
      windowMs: 60 * 1000,
    });

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
      return NextResponse.json(
        { error: 'AI Gateway API key is not configured.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as DialogueRequestPayload;
    const {
      productName,
      productImageUrls = [],
      language = 'en',
      videoDurationSeconds
    } = body;

    const cleanedImageUrls = productImageUrls
      .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 3);

    const nameSnippet = productName?.trim() || 'the product';
    const languageName = getLanguagePromptName(language);

    const dialogueWordLimit = getAvatarAdsDialogueWordLimit(
      typeof videoDurationSeconds === 'number' ? videoDurationSeconds : 16
    );

    const systemPrompt = `You are an advertising dialogue writer for user-generated content spokesperson videos.\n
Requirements:\n- Return exactly one spoken line capped at ${dialogueWordLimit} words in ${languageName}.\n- Sound casual, enthusiastic, and authentic as if spoken on camera.\n- Blend a hook, the key benefit, and a friendly call-to-action.\n- Avoid hashtags, emojis, marketing buzzwords, or repeated punctuation.\n- Do not add quotes or surrounding characters.\n- Base the line on the product imagery and description provided.\n- The dialogue MUST be written in ${languageName}.`;

    const userTextPrompt = `Product Name: ${nameSnippet}\nLanguage: ${languageName}\nIf possible, reference standout visuals you observe. Respond with one spoken line in ${languageName} now.`;

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      { type: 'text', text: userTextPrompt }
    ];

    if (cleanedImageUrls.length) {
      userContent.push({ type: 'text', text: 'Reference product photos:' });
      cleanedImageUrls.forEach((url) => {
        userContent.push({ type: 'image_url', image_url: { url } });
      });
    }

    const data = await sendAIGatewayChat({
      model: process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
        { role: 'user', content: userContent }
      ],
      max_tokens: 140,
      temperature: 0.65,
    }, {
      maxRetries: 3,
      timeoutMs: 45000,
      httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      xTitle: 'Flowtra'
    });

    const rawContent = extractAIGatewayTextContent(data?.choices?.[0]?.message?.content) ?? undefined;

    if (!rawContent) {
      return NextResponse.json(
        { error: 'No dialogue returned from AI Gateway.' },
        { status: 502 }
      );
    }

    const cleanedContent = rawContent
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const trimmedContent = clampDialogueToWordLimit(cleanedContent, dialogueWordLimit);

    return NextResponse.json({ success: true, dialogue: trimmedContent });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds) },
        }
      );
    }

    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error || 'Failed to generate dialogue.', details: networkError.details },
      { status: networkError.status || 500 }
    );
  }
}
