import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '@/lib/constants';
import { getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { isLanguageCode } from '@/lib/language';
import { extractOpenRouterJsonContent, sendOpenRouterChat } from '@/lib/openrouter';

type LanguageRecommendResponse = {
  language: LanguageCode;
  reason?: string;
};

type RecommendAvatarAdsSpokenLanguageInput = {
  script?: string | null;
  supportedLanguages?: LanguageCode[];
};

export class AvatarAdsLanguageRecommendationError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'AvatarAdsLanguageRecommendationError';
    this.status = status;
    this.details = details;
  }
}

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

const normalizeSupportedLanguages = (supportedLanguages: LanguageCode[]) => {
  if (!supportedLanguages.length) {
    throw new AvatarAdsLanguageRecommendationError('At least one supported language is required.', 400);
  }

  const normalizedLanguages = supportedLanguages
    .map((language) => String(language).trim().toLowerCase())
    .filter((language): language is LanguageCode => isLanguageCode(language));

  if (normalizedLanguages.length !== supportedLanguages.length) {
    throw new AvatarAdsLanguageRecommendationError('Unsupported language detected in supportedLanguages.', 400);
  }

  return Array.from(new Set(normalizedLanguages));
};

export async function recommendAvatarAdsSpokenLanguage({
  script,
  supportedLanguages = SUPPORTED_LANGUAGE_CODES,
}: RecommendAvatarAdsSpokenLanguageInput): Promise<LanguageRecommendResponse> {
  const trimmedScript = script?.trim();

  if (!process.env.OPENROUTER_API_KEY) {
    throw new AvatarAdsLanguageRecommendationError('OpenRouter API key is not configured.', 500);
  }

  if (!trimmedScript) {
    throw new AvatarAdsLanguageRecommendationError('Script is required.', 400);
  }

  const dedupedLanguages = normalizeSupportedLanguages(supportedLanguages);

  const systemPrompt = [
    'You are a language recommendation assistant for avatar video generation.',
    'Choose exactly one best spoken language from the provided supportedLanguages list.',
    'Base the decision on the script language, natural pronunciation, and the most likely intended spoken output.',
    'Never return a language outside the provided supportedLanguages list.',
    'Return valid JSON only.'
  ].join(' ');

  const userPrompt = JSON.stringify({
    supportedLanguages: dedupedLanguages,
    script: trimmedScript,
    task: 'Select the single best language code for this avatar ad script.'
  });

  try {
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
      throw new AvatarAdsLanguageRecommendationError('Invalid language recommendation returned from OpenRouter.', 502);
    }

    return {
      language: parsed.language,
      reason: parsed.reason,
    };
  } catch (error) {
    if (error instanceof AvatarAdsLanguageRecommendationError) {
      throw error;
    }

    const networkError = getNetworkErrorResponse(error);
    throw new AvatarAdsLanguageRecommendationError(
      networkError.error || 'Failed to recommend language.',
      networkError.status || 500,
      networkError.details
    );
  }
}
