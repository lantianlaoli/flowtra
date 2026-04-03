import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '@/lib/constants';
import { sendOpenRouterChat } from '@/lib/openrouter';
import { normalizeAnalysisToV2, type CanonicalAnalysisV2 } from '@/lib/video-analysis-schema';

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
const SHOT_DURATION_TOLERANCE_SECONDS = 2;

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
  'timing',
  'opening_frame',
  'visual',
  'audio'
] as const;

const hasSpeechSignal = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return /\b(voiceover|dialogue|dialog|narrat|says|speaks|speaking|talking|spoken|caption|subtitle|line)\b/.test(normalized);
};

const parseTimecodeSeconds = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map(part => Number(part.trim()));
  if (parts.length < 2 || parts.length > 4 || parts.some(part => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }

  if (parts.length === 4) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }

  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
};

const validateStrictShotSchema = (analysis: Record<string, unknown> | CanonicalAnalysisV2): { valid: boolean; reason?: string } => {
  const normalized = normalizeAnalysisToV2(analysis as Record<string, unknown>);
  if (!normalized) {
    return { valid: false, reason: 'Analysis payload is not a valid object.' };
  }

  const shots = normalized.shots;
  if (!Array.isArray(shots) || shots.length === 0) {
    return { valid: false, reason: 'No shots array returned.' };
  }

  let previousEndSeconds = 0;
  let accumulatedDurationSeconds = 0;
  let hasNonZeroTimeRange = false;

  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    if (!shot || typeof shot !== 'object') {
      return { valid: false, reason: `Shot ${i + 1} is not an object.` };
    }
    const record = shot as unknown as CanonicalAnalysisV2['shots'][number];

    for (const field of REQUIRED_SHOT_FIELDS) {
      if (!(field in record)) {
        return { valid: false, reason: `Shot ${i + 1} is missing required field "${field}".` };
      }
    }

    const requiredTextFields: Array<[string, string]> = [
      ['opening_frame.description', record.opening_frame.description],
      ['visual.subject', record.visual.subject],
      ['visual.environment', record.visual.environment],
      ['visual.action', record.visual.action],
      ['visual.style', record.visual.style],
      ['visual.camera', record.visual.camera],
      ['visual.composition', record.visual.composition],
      ['visual.ambiance', record.visual.ambiance],
      ['audio.ambient', record.audio.ambient]
    ];

    const missingField = requiredTextFields.find(([, value]) => typeof value !== 'string' || !value.trim());
    if (missingField) {
      return { valid: false, reason: `Shot ${i + 1} has an empty required field "${missingField[0]}".` };
    }

    const ambient = typeof record.audio.ambient === 'string' ? record.audio.ambient : '';
    const sfx = typeof record.audio.sfx === 'string' ? record.audio.sfx : '';
    const dialogue = typeof record.audio.dialogue === 'string' ? record.audio.dialogue : '';
    if (hasSpeechSignal(`${ambient} ${sfx}`) && !dialogue.trim()) {
      return {
        valid: false,
        reason: `Shot ${i + 1} indicates spoken audio in audio fields but returned empty "dialogue".`
      };
    }

    const startSeconds = parseTimecodeSeconds(record.timing.start_time);
    const endSeconds = parseTimecodeSeconds(record.timing.end_time);
    const durationSeconds = Number(record.timing.duration_seconds);

    if (startSeconds === null || endSeconds === null) {
      return { valid: false, reason: `Shot ${i + 1} has an invalid timecode.` };
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return { valid: false, reason: `Shot ${i + 1} has an invalid duration.` };
    }

    if (endSeconds <= startSeconds) {
      return { valid: false, reason: `Shot ${i + 1} end_time must be greater than start_time.` };
    }

    if (Math.abs((endSeconds - startSeconds) - Math.round(durationSeconds)) > 1) {
      return { valid: false, reason: `Shot ${i + 1} time span does not match duration_seconds.` };
    }

    if (i === 0 && startSeconds !== 0) {
      return { valid: false, reason: 'Shot 1 must start at 00:00.' };
    }

    if (i > 0 && startSeconds !== previousEndSeconds) {
      return { valid: false, reason: `Shot ${i + 1} must start exactly when shot ${i} ends.` };
    }

    previousEndSeconds = endSeconds;
    accumulatedDurationSeconds += Math.round(durationSeconds);
    if (endSeconds > 0) {
      hasNonZeroTimeRange = true;
    }
  }

  if (!hasNonZeroTimeRange) {
    return { valid: false, reason: 'All shots returned placeholder 00:00 timing.' };
  }

  if (Math.abs(previousEndSeconds - normalized.video_duration_seconds) > SHOT_DURATION_TOLERANCE_SECONDS) {
    return {
      valid: false,
      reason: `Shot timeline ends at ${previousEndSeconds}s but video_duration_seconds is ${normalized.video_duration_seconds}s.`
    };
  }

  if (Math.abs(accumulatedDurationSeconds - normalized.video_duration_seconds) > SHOT_DURATION_TOLERANCE_SECONDS) {
    return {
      valid: false,
      reason: `Sum of shot durations is ${accumulatedDurationSeconds}s but video_duration_seconds is ${normalized.video_duration_seconds}s.`
    };
  }

  return { valid: true };
};

const parseCreatorVideoAnalysisResponse = (data: unknown) => {
  const apiResponse = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const rawContent = apiResponse.choices?.[0]?.message?.content;

  // If the SDK already parsed content into an object (structured output / response_format), use it directly.
  if (rawContent !== null && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    return {
      ok: true as const,
      parsed: rawContent as Record<string, unknown>
    };
  }

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
}) => {
  return sendOpenRouterChat({
    model: params.model,
    ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: params.relaxedMode
              ? `Analyze this creator reference video${params.sourceName ? ` from "${params.sourceName}"` : ''} and return ONLY one valid JSON object.
You MUST return complete shot objects in schema_version 2 format. Every shot must include:
- shot_id
- timing.start_time
- timing.end_time
- timing.duration_seconds
- opening_frame.description
- visual.subject
- visual.action
- visual.environment
- visual.style
- visual.camera
- visual.composition
- visual.focus_lens_effects
- visual.ambiance
- audio.dialogue
- audio.sfx
- audio.ambient

Global required fields:
- schema_version
- name
- video_duration_seconds
- shots
- detected_language

Rules:
- Do not include markdown or explanations.
- shots must be an ordered array with complete timeline coverage.
- timing.start_time and timing.end_time must be real contiguous timecodes, not placeholders.
- Shot 1 must start at 00:00.
- Each next shot must start exactly when the previous shot ends.
- timing.end_time must be greater than timing.start_time for every shot.
- timing.duration_seconds must equal the exact difference between timing.start_time and timing.end_time.
- The final shot should end at video_duration_seconds, but up to 2 seconds difference is acceptable if cuts are otherwise coherent.
- Do not return repeated 00:00-00:00 ranges or a flat default duration for every shot unless the source video truly has identical cuts.
- audio.dialogue must be the best-effort literal spoken words for this shot.
- Use subtitle/caption text when visible.
- If speech is partially unclear, infer the most likely spoken words from captions and context.
- If the shot has no speech, return audio.dialogue as an empty string.
- audio.ambient must describe the background environmental sound bed for the shot.
- audio.sfx must describe distinct non-environment sound effects for the shot.
- If language is unclear, set detected_language to "en".`
                : `Analyze this creator reference video${params.sourceName ? ` from "${params.sourceName}"` : ''} and output a strict JSON shot breakdown in schema_version 2 format.
Requirements:
- Return JSON only, matching the schema.
- Cover the full video timeline with ordered shots.
- Shot timing is mandatory and must be production-usable.
- Shot 1 must start at 00:00.
- Every shot must have a real timing.start_time and timing.end_time.
- Shots must be contiguous with no gaps and no overlaps.
- Every next shot must start exactly at the previous shot's end.
- timing.duration_seconds must exactly equal end_time - start_time.
- The sum of all shot durations should closely match video_duration_seconds. Up to 2 seconds difference is acceptable.
- The final shot should end at video_duration_seconds, but up to 2 seconds difference is acceptable.
- Never use placeholder timing such as 00:00-00:00 for multiple shots.
- Never assign the same default duration to every shot unless the actual video cuts are genuinely uniform.
- Keep each field concrete and production-usable for storyboard recreation.
- Detect primary language and output it in detected_language.
- If language is unclear, default to "en".
- Every shot MUST include non-empty: opening_frame.description, visual.subject, visual.action, visual.environment, visual.style, visual.camera, visual.composition, visual.ambiance, audio.ambient.
- visual.focus_lens_effects must always be present and may be "" when not inferable.
- Every shot MUST include audio.dialogue as a string.
- audio.dialogue = the best-effort literal spoken line for that shot, prioritizing audible speech and visible subtitles/captions.
- If spoken words continue across multiple shots, split them by the most likely shot boundary.
- If speech is partially unclear, infer aggressively from subtitle/context and return the most likely line instead of a summary.
- If the shot is clearly silent, set audio.dialogue to "".
- audio.sfx = explicit sound effects only.
- audio.ambient = background environment sound only.
- If a legacy combined sound description is all you can infer, put it in audio.ambient.`
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

  // Required: video analysis model
  const model = process.env.OPENROUTER_MODEL;
  if (!model) {
    throw new Error('OPENROUTER_MODEL is not configured.');
  }

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
          schema_version: { type: 'number' },
          name: { type: 'string' },
          video_duration_seconds: { type: 'number' },
          shots: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                shot_id: { type: 'number' },
                timing: {
                  type: 'object',
                  properties: {
                    start_time: { type: 'string' },
                    end_time: { type: 'string' },
                    duration_seconds: { type: 'number' }
                  },
                  required: ['start_time', 'end_time', 'duration_seconds'],
                  additionalProperties: false
                },
                opening_frame: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' }
                  },
                  required: ['description'],
                  additionalProperties: false
                },
                visual: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string' },
                    action: { type: 'string' },
                    environment: { type: 'string' },
                    style: { type: 'string' },
                    camera: { type: 'string' },
                    composition: { type: 'string' },
                    focus_lens_effects: { type: 'string' },
                    ambiance: { type: 'string' }
                  },
                  required: ['subject', 'action', 'environment', 'style', 'camera', 'composition', 'focus_lens_effects', 'ambiance'],
                  additionalProperties: false
                },
                audio: {
                  type: 'object',
                  properties: {
                    dialogue: { type: 'string' },
                    sfx: { type: 'string' },
                    ambient: { type: 'string' },
                  },
                  required: ['dialogue', 'sfx', 'ambient'],
                  additionalProperties: false
                },
                flags: {
                  type: 'object',
                  properties: {
                    contains_brand: { type: 'boolean' },
                    contains_product: { type: 'boolean' }
                  },
                  additionalProperties: false
                }
              },
              required: [
                'shot_id',
                'timing',
                'opening_frame',
                'visual',
                'audio'
              ],
              additionalProperties: false
            }
          },
          detected_language: { type: 'string' }
        },
        required: ['schema_version', 'name', 'video_duration_seconds', 'shots', 'detected_language'],
        additionalProperties: false
      }
    }
  } as const;

  const executeAttempt = async (opts: { relaxedMode: boolean; includeResponseFormat: boolean }) => {
    let data: unknown;
    try {
      data = await callOpenRouterForCreatorVideo({
        model,
        videoUrl: input.videoUrl,
        sourceName: input.sourceName,
        responseFormat: opts.includeResponseFormat ? (responseFormat as Record<string, unknown>) : undefined,
        relaxedMode: opts.relaxedMode,
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
  let parsedResult = parseCreatorVideoAnalysisResponse(firstAttempt.data);

  // Attempt 2 fallback: no response_format, plain JSON-only instruction.
  if (!parsedResult.ok) {
    console.warn('[CreatorVideoAnalysis] First parse failed, retrying without response_format:', {
      ...debugContext,
      reason: parsedResult.reason
    });
    const secondAttempt = await executeAttempt({ relaxedMode: true, includeResponseFormat: false });
    parsedResult = parseCreatorVideoAnalysisResponse(secondAttempt.data);
  }

  if (!parsedResult.ok) {
    console.error('[CreatorVideoAnalysis] Missing/invalid message content:', {
      ...debugContext,
      reason: parsedResult.reason,
      normalizedPreview: parsedResult.normalizedContent ? truncateForLog(parsedResult.normalizedContent, 600) : null
    });
    throw new Error(parsedResult.reason);
  }

  const result = normalizeAnalysisToV2(parsedResult.parsed);
  if (!result) {
    throw new Error('Failed to normalize creator video analysis response.');
  }

  let strictValidation = validateStrictShotSchema(result);
  if (!strictValidation.valid) {
    console.warn('[CreatorVideoAnalysis] Structured output failed validation, retrying with relaxed prompt:', {
      ...debugContext,
      reason: strictValidation.reason
    });

    const secondAttempt = await executeAttempt({ relaxedMode: true, includeResponseFormat: false });
    parsedResult = parseCreatorVideoAnalysisResponse(secondAttempt.data);
    if (!parsedResult.ok) {
      console.error('[CreatorVideoAnalysis] Retry after validation failure could not be parsed:', {
        ...debugContext,
        reason: parsedResult.reason,
        normalizedPreview: parsedResult.normalizedContent ? truncateForLog(parsedResult.normalizedContent, 600) : null
      });
      throw new Error(parsedResult.reason);
    }

    const retriedResult = normalizeAnalysisToV2(parsedResult.parsed);
    if (!retriedResult) {
      throw new Error('Failed to normalize creator video analysis response after validation retry.');
    }

    strictValidation = validateStrictShotSchema(retriedResult);
    if (!strictValidation.valid) {
      console.error('[CreatorVideoAnalysis] Strict shot schema validation failed after retry:', {
        ...debugContext,
        reason: strictValidation.reason
      });
      throw new Error(`Shot schema incomplete: ${strictValidation.reason}`);
    }

    const retriedLanguage = typeof retriedResult.detected_language === 'string' ? retriedResult.detected_language : undefined;
    const language: LanguageCode = retriedLanguage && SUPPORTED_LANGUAGE_CODES.includes(retriedLanguage as LanguageCode)
      ? (retriedLanguage as LanguageCode)
      : 'en';

    console.log('[CreatorVideoAnalysis] Analysis parsed successfully after validation retry:', {
      ...debugContext,
      detectedLanguage: language,
      shotsCount: Array.isArray(retriedResult.shots) ? retriedResult.shots.length : 0,
      duration: typeof retriedResult.video_duration_seconds === 'number' ? retriedResult.video_duration_seconds : null
    });

    return { analysis: retriedResult as unknown as Record<string, unknown>, language };
  }

  const rawDetectedLanguage = typeof result.detected_language === 'string' ? result.detected_language : undefined;
  const language: LanguageCode = rawDetectedLanguage && SUPPORTED_LANGUAGE_CODES.includes(rawDetectedLanguage as LanguageCode)
    ? (rawDetectedLanguage as LanguageCode)
    : 'en';

  console.log('[CreatorVideoAnalysis] Analysis parsed successfully:', {
    ...debugContext,
    detectedLanguage: language,
    shotsCount: Array.isArray(result.shots) ? result.shots.length : 0,
    duration: typeof result.video_duration_seconds === 'number' ? result.video_duration_seconds : null
  });

  return { analysis: result as unknown as Record<string, unknown>, language };
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

export const __test__ = {
  hasSpeechSignal,
  parseCreatorVideoAnalysisResponse,
  validateStrictShotSchema,
};
