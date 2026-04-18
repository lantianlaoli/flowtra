import { NextRequest, NextResponse } from 'next/server';
import { getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '@/lib/constants';
import { isLanguageCode } from '@/lib/language';
import { extractOpenRouterJsonContent, sendOpenRouterChat } from '@/lib/openrouter';

type LanguageRecommendRequest = {
  script?: string;
  supportedLanguages?: LanguageCode[];
};

type LanguageRecommendResponse = {
  language: LanguageCode;
  reason?: string;
};

const MODEL = process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash';

const responseFormat = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'avatar_ads_language_recommendation',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        language: {
          type: 'string',
          enum: SUPPORTED_LANGUAGE_CODES,
        },
        reason: {
          type: 'string',
        }
      },
      required: ['language', 'reason']
    }
  }
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as LanguageRecommendRequest;
    const script = body.script?.trim();
    const requestedLanguages = Array.isArray(body.supportedLanguages)
      ? body.supportedLanguages
      : [];

    if (!script) {
      return NextResponse.json(
        { error: 'Script is required.' },
        { status: 400 }
      );
    }

    if (!requestedLanguages.length) {
      return NextResponse.json(
        { error: 'At least one supported language is required.' },
        { status: 400 }
      );
    }

    const normalizedLanguages = requestedLanguages
      .map((language) => String(language).trim().toLowerCase())
      .filter((language): language is LanguageCode => isLanguageCode(language));

    if (normalizedLanguages.length !== requestedLanguages.length) {
      return NextResponse.json(
        { error: 'Unsupported language detected in supportedLanguages.' },
        { status: 400 }
      );
    }

    const dedupedLanguages = Array.from(new Set(normalizedLanguages));

    const systemPrompt = [
      'You are a language recommendation assistant for avatar video generation.',
      'Choose exactly one best spoken language from the provided supportedLanguages list.',
      'Base the decision on the script language, natural pronunciation, and the most likely intended spoken output.',
      'Never return a language outside the provided supportedLanguages list.',
      'Return valid JSON only.'
    ].join(' ');

    const userPrompt = JSON.stringify({
      supportedLanguages: dedupedLanguages,
      script,
      task: 'Select the single best language code for this avatar ad script.'
    });

    const data = await sendOpenRouterChat({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: responseFormat,
      temperature: 0.1,
      max_tokens: 120
    }, {
      maxRetries: 3,
      timeoutMs: 45000,
      httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      xTitle: 'Flowtra'
    });

    const parsed = extractOpenRouterJsonContent<LanguageRecommendResponse>(
      data?.choices?.[0]?.message?.content
    );

    if (!parsed?.language || !dedupedLanguages.includes(parsed.language)) {
      return NextResponse.json(
        { error: 'Invalid language recommendation returned from OpenRouter.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      language: parsed.language,
      reason: parsed.reason,
    });
  } catch (error) {
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error || 'Failed to recommend language.', details: networkError.details },
      { status: networkError.status || 500 }
    );
  }
}
