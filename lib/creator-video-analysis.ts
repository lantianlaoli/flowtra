import type { SupabaseClient } from '@supabase/supabase-js';
import type { LanguageCode } from '@/lib/constants';
import { sendOpenRouterChat } from '@/lib/openrouter';

type StructuredContentChunk =
  | string
  | {
      type?: string;
      text?: unknown;
      content?: unknown;
    };

const getChunkText = (chunk: StructuredContentChunk): string => {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (chunk && typeof chunk === 'object') {
    if (typeof chunk.text === 'string') {
      return chunk.text;
    }
    if (typeof chunk.content === 'string') {
      return chunk.content;
    }
  }
  return '';
};

const extractStructuredContent = (content: unknown): string | null => {
  if (!content) return null;
  if (typeof content === 'string') {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const combined = content
      .map(chunk => getChunkText(chunk))
      .filter(Boolean)
      .join('\n')
      .trim();

    return combined || null;
  }

  if (typeof content === 'object') {
    const maybeText = getChunkText(content as StructuredContentChunk);
    if (maybeText) {
      return maybeText;
    }
  }

  return null;
};

const truncateForLog = (value: string, max = 800): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isTransientProviderError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('provider_code=500')
    || normalized.includes('status=500')
    || normalized.includes('internal server error');
};

const MAX_ANALYSIS_RETRIES = 2;

const extractJsonObjectFromText = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Handle markdown code blocks first.
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;

  // Try full text first.
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Continue.
  }

  // Fallback: pick the first plausible JSON object span.
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const objectSlice = candidate.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(objectSlice);
      return objectSlice;
    } catch {
      return null;
    }
  }

  return null;
};

const REQUIRED_SHOT_FIELDS = [
  'shot_id',
  'start_time',
  'end_time',
  'duration_seconds',
  'first_frame_description',
  'subject',
  'context_environment',
  'action',
  'style',
  'camera_motion_positioning',
  'composition',
  'ambiance_colour_lighting',
  'audio'
] as const;

const validateStrictShotSchema = (analysis: Record<string, unknown>): { valid: boolean; reason?: string } => {
  const shots = analysis.shots;
  if (!Array.isArray(shots) || shots.length === 0) {
    return { valid: false, reason: 'No shots array returned.' };
  }

  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    if (!shot || typeof shot !== 'object') {
      return { valid: false, reason: `Shot ${i + 1} is not an object.` };
    }
    const record = shot as Record<string, unknown>;

    for (const field of REQUIRED_SHOT_FIELDS) {
      if (!(field in record)) {
        return { valid: false, reason: `Shot ${i + 1} is missing required field "${field}".` };
      }
    }

    const requiredTextFields = [
      'first_frame_description',
      'subject',
      'context_environment',
      'action',
      'style',
      'camera_motion_positioning',
      'composition',
      'ambiance_colour_lighting',
      'audio'
    ] as const;

    for (const field of requiredTextFields) {
      const value = record[field];
      if (typeof value !== 'string' || !value.trim()) {
        return { valid: false, reason: `Shot ${i + 1} has empty "${field}".` };
      }
    }
  }

  return { valid: true };
};

const buildDebugContext = (input: { videoUrl: string; sourceName: string; model: string }) => {
  let urlHost = 'invalid-url';
  let urlPath = '';
  try {
    const parsed = new URL(input.videoUrl);
    urlHost = parsed.host;
    urlPath = parsed.pathname;
  } catch {
    // keep defaults
  }

  return {
    sourceName: input.sourceName || 'unknown',
    model: input.model,
    videoUrlHost: urlHost,
    videoUrlPath: urlPath,
    videoUrlLength: input.videoUrl.length
  };
};

const callOpenRouterForCreatorVideo = async (params: {
  model: string;
  videoUrl: string;
  sourceName: string;
  responseFormat?: Record<string, unknown>;
  relaxedMode?: boolean;
  providerIgnore?: string[];
}) => {
  return sendOpenRouterChat({
    model: params.model,
    ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
    ...(params.providerIgnore && params.providerIgnore.length > 0
      ? { provider: { ignore: params.providerIgnore } }
      : {}),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: params.relaxedMode
              ? `Analyze this creator reference video${params.sourceName ? ` from "${params.sourceName}"` : ''} and return ONLY one valid JSON object.
You MUST return complete shot objects. Every shot must include ALL required fields below and none may be empty:
- shot_id
- start_time
- end_time
- duration_seconds
- first_frame_description
- subject
- context_environment
- action
- style
- camera_motion_positioning
- composition
- ambiance_colour_lighting
- audio

Global required fields:
- name
- video_duration_seconds
- shots
- detected_language

Rules:
- Do not include markdown or explanations.
- shots must be an ordered array with complete timeline coverage.
- If language is unclear, set detected_language to "en".`
              : `Analyze this creator reference video${params.sourceName ? ` from "${params.sourceName}"` : ''} and output a strict JSON shot breakdown.
Requirements:
- Return JSON only, matching the schema.
- Cover the full video timeline with ordered shots.
- Keep each field concrete and production-usable for storyboard recreation.
- Detect primary language and output it in detected_language.
- If language is unclear, default to "en".
- Every shot MUST include non-empty: first_frame_description, subject, context_environment, action, style, camera_motion_positioning, composition, ambiance_colour_lighting, audio.`
          },
          {
            type: 'video_url',
            video_url: {
              url: params.videoUrl
            }
          }
        ]
      }
    ]
  }, {
    maxRetries: 10,
    timeoutMs: 45000
  });
};

const analyzeCreatorVideoByUrl = async (input: {
  videoUrl: string;
  sourceName: string;
}): Promise<{ analysis: Record<string, unknown>; language: LanguageCode }> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  // Required (no fallback by design): uploader flow must use a dedicated video-analysis model.
  const model = process.env.OPENROUTER_ANALYSIS_VIDEO_MODEL;
  if (!model) {
    throw new Error('OPENROUTER_ANALYSIS_VIDEO_MODEL is not configured.');
  }
  const providerIgnore = (process.env.OPENROUTER_ANALYSIS_VIDEO_IGNORE_PROVIDERS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const debugContext = buildDebugContext({
    videoUrl: input.videoUrl,
    sourceName: input.sourceName,
    model
  });
  console.log('[CreatorVideoAnalysis] Starting OpenRouter video_url analysis:', debugContext);

  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'creator_video_analysis_schema',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          video_duration_seconds: { type: 'number' },
          shots: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                shot_id: { type: 'number' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                duration_seconds: { type: 'number' },
                first_frame_description: { type: 'string' },
                subject: { type: 'string' },
                context_environment: { type: 'string' },
                action: { type: 'string' },
                style: { type: 'string' },
                camera_motion_positioning: { type: 'string' },
                composition: { type: 'string' },
                ambiance_colour_lighting: { type: 'string' },
                audio: { type: 'string' }
              },
              required: [
                'shot_id',
                'start_time',
                'end_time',
                'duration_seconds',
                'first_frame_description',
                'subject',
                'context_environment',
                'action',
                'style',
                'camera_motion_positioning',
                'composition',
                'ambiance_colour_lighting',
                'audio'
              ],
              additionalProperties: false
            }
          },
          detected_language: { type: 'string' }
        },
        required: ['name', 'video_duration_seconds', 'shots', 'detected_language'],
        additionalProperties: false
      }
    }
  } as const;

  const parseApiResponse = (data: unknown, responseText: string) => {
    const apiResponse = data as { choices?: Array<{ message?: { content?: unknown } }> };
    const rawContent = apiResponse.choices?.[0]?.message?.content;
    const normalizedContent = extractStructuredContent(rawContent);

    if (!normalizedContent) {
      return {
        ok: false as const,
        reason: `Invalid creator video analysis response format. choices=${Array.isArray(apiResponse.choices) ? apiResponse.choices.length : 0}; rawContentType=${typeof rawContent}`,
        normalizedContent: null
      };
    }

    const jsonPayload = extractJsonObjectFromText(normalizedContent);
    if (!jsonPayload) {
      return {
        ok: false as const,
        reason: `Invalid creator video analysis JSON payload. normalizedPreview=${truncateForLog(normalizedContent, 220)}`,
        normalizedContent
      };
    }

    try {
      const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;
      return {
        ok: true as const,
        parsed
      };
    } catch {
      return {
        ok: false as const,
        reason: `Invalid creator video analysis JSON payload. normalizedPreview=${truncateForLog(normalizedContent, 220)}`,
        normalizedContent
      };
    }
  };

  const executeAttempt = async (opts: { relaxedMode: boolean; includeResponseFormat: boolean }) => {
    let data: unknown;
    try {
      data = await callOpenRouterForCreatorVideo({
        model,
        videoUrl: input.videoUrl,
        sourceName: input.sourceName,
        responseFormat: opts.includeResponseFormat ? (responseFormat as Record<string, unknown>) : undefined,
        relaxedMode: opts.relaxedMode,
        providerIgnore
      });
      console.log('[CreatorVideoAnalysis] OpenRouter response received:', {
        ...debugContext,
        bodyPreview: truncateForLog(JSON.stringify(data), 600)
      });
    } catch (error) {
      console.error('[CreatorVideoAnalysis] OpenRouter request failed:', {
        ...debugContext,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    const apiError = data as {
      error?: {
        message?: string;
        code?: string | number;
        metadata?: { provider_name?: string };
      };
    };

    // OpenRouter docs: some upstream/provider failures can surface as HTTP 200 with { error: {...} } in body.
    if (apiError?.error?.message) {
      const providerName = apiError.error.metadata?.provider_name || 'unknown';
      const providerCode = apiError.error.code ?? 'unknown';
      const providerMessage = apiError.error.message;
      console.error('[CreatorVideoAnalysis] OpenRouter body-level error (HTTP 200):', {
        ...debugContext,
        providerName,
        providerCode,
        providerMessage
      });

      if (providerMessage.includes('DataInspectionFailed')) {
        throw new Error(
          `Video rejected by provider content inspection (${providerName}). Please use a different clip or switch analysis model/provider. [provider_code=${String(providerCode)}]`
        );
      }

      throw new Error(
        `OpenRouter provider error (${providerName}): ${providerMessage} [provider_code=${String(providerCode)}]`
      );
    }

    return { responseText: JSON.stringify(data), data };
  };

  // Attempt 1: strict schema response_format
  const firstAttempt = await executeAttempt({ relaxedMode: false, includeResponseFormat: true });
  let parsedResult = parseApiResponse(firstAttempt.data, firstAttempt.responseText);

  // Attempt 2 fallback: no response_format, plain JSON-only instruction.
  if (!parsedResult.ok) {
    console.warn('[CreatorVideoAnalysis] First parse failed, retrying without response_format:', {
      ...debugContext,
      reason: parsedResult.reason
    });
    const secondAttempt = await executeAttempt({ relaxedMode: true, includeResponseFormat: false });
    parsedResult = parseApiResponse(secondAttempt.data, secondAttempt.responseText);
  }

  if (!parsedResult.ok) {
    console.error('[CreatorVideoAnalysis] Missing/invalid message content:', {
      ...debugContext,
      reason: parsedResult.reason,
      normalizedPreview: parsedResult.normalizedContent ? truncateForLog(parsedResult.normalizedContent, 600) : null
    });
    throw new Error(parsedResult.reason);
  }

  const result = parsedResult.parsed;
  const strictValidation = validateStrictShotSchema(result);
  if (!strictValidation.valid) {
    console.error('[CreatorVideoAnalysis] Strict shot schema validation failed:', {
      ...debugContext,
      reason: strictValidation.reason
    });
    throw new Error(`Shot schema incomplete: ${strictValidation.reason}`);
  }

  const rawDetectedLanguage = typeof result.detected_language === 'string' ? result.detected_language : undefined;
  const validLanguageCodes: LanguageCode[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'zh', 'ur', 'pa', 'id'];
  const language: LanguageCode = rawDetectedLanguage && validLanguageCodes.includes(rawDetectedLanguage as LanguageCode)
    ? (rawDetectedLanguage as LanguageCode)
    : 'en';

  console.log('[CreatorVideoAnalysis] Analysis parsed successfully:', {
    ...debugContext,
    detectedLanguage: language,
    shotsCount: Array.isArray(result.shots) ? result.shots.length : 0,
    duration: typeof result.video_duration_seconds === 'number' ? result.video_duration_seconds : null
  });

  return { analysis: result, language };
};

interface CreatorVideoAnalysisInput {
  supabase: SupabaseClient;
  videoId: string;
  videoUrl: string;
  sourceName: string;
  durationSeconds?: number | null;
}

export const analyzeCreatorVideoAndUpdate = async ({
  supabase,
  videoId,
  videoUrl,
  sourceName,
  durationSeconds
}: CreatorVideoAnalysisInput) => {
  // Schema verified via Supabase MCP (2026-02-25): creator_source_videos includes
  // analysis_status, analysis_result, analysis_error, analysis_language, analyzed_at, duration_seconds
  const { error: markAnalyzingError } = await supabase
    .from('creator_source_videos')
    .update({
      analysis_status: 'analyzing',
      analysis_error: null
    })
    .eq('id', videoId);
  if (markAnalyzingError) {
    console.error('[CreatorVideoAnalysis] Failed to mark as analyzing:', {
      videoId,
      error: markAnalyzingError.message
    });
    return { error: `Failed to set analyzing status: ${markAnalyzingError.message}` };
  }

  try {
    let analysisResult: { analysis: Record<string, unknown>; language: LanguageCode } | null = null;
    let analysisError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ANALYSIS_RETRIES; attempt += 1) {
      try {
        analysisResult = await analyzeCreatorVideoByUrl({
          videoUrl,
          sourceName
        });
        analysisError = null;
        break;
      } catch (error) {
        analysisError = error instanceof Error ? error : new Error('Analysis failed');
        const shouldRetry = attempt < MAX_ANALYSIS_RETRIES && isTransientProviderError(analysisError.message);

        console.warn('[CreatorVideoAnalysis] Analysis attempt failed:', {
          videoId,
          attempt,
          maxAttempts: MAX_ANALYSIS_RETRIES,
          shouldRetry,
          message: analysisError.message
        });

        if (!shouldRetry) {
          throw analysisError;
        }

        await wait(1200 * attempt);
      }
    }

    if (!analysisResult) {
      throw analysisError || new Error('Analysis failed');
    }

    const { analysis, language } = analysisResult;

    const rawDuration = (analysis as Record<string, unknown>)?.video_duration_seconds;
    const detectedDuration = typeof rawDuration === 'number' && Number.isFinite(rawDuration)
      ? Math.max(0, Math.round(rawDuration))
      : null;

    const { error: completeUpdateError } = await supabase
      .from('creator_source_videos')
      .update({
        analysis_status: 'completed',
        analysis_result: analysis,
        analysis_language: language,
        analysis_error: null,
        analyzed_at: new Date().toISOString(),
        duration_seconds: detectedDuration ?? durationSeconds ?? null
      })
      .eq('id', videoId);
    if (completeUpdateError) {
      console.error('[CreatorVideoAnalysis] Failed to persist completed analysis:', {
        videoId,
        error: completeUpdateError.message,
        language,
        hasShots: Array.isArray((analysis as Record<string, unknown>).shots),
        shotsCount: Array.isArray((analysis as Record<string, unknown>).shots)
          ? ((analysis as Record<string, unknown>).shots as unknown[]).length
          : 0
      });
      throw new Error(`Failed to save analysis result: ${completeUpdateError.message}`);
    }

    return { analysis, language };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    const { error: failedUpdateError } = await supabase
      .from('creator_source_videos')
      .update({
        analysis_status: 'failed',
        analysis_error: message,
        analyzed_at: new Date().toISOString()
      })
      .eq('id', videoId);
    if (failedUpdateError) {
      console.error('[CreatorVideoAnalysis] Failed to persist failure status:', {
        videoId,
        originalError: message,
        persistError: failedUpdateError.message
      });
    }

    return { error: message };
  }
};
