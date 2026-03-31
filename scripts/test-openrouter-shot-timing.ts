#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { sendOpenRouterChat } from '../lib/openrouter';
import { normalizeAnalysisToV2 } from '../lib/video-analysis-schema';
import { parseCompetitorTimeline } from '../lib/competitor-shots';
import { __test__ as creatorVideoAnalysisTestUtils } from '../lib/creator-video-analysis';

const videoUrl = process.argv[2]?.trim();
const sourceName = process.argv[3]?.trim() || 'OpenRouter timing test';
const model = process.env.OPENROUTER_ANALYSIS_VIDEO_MODEL || process.env.OPENROUTER_MODEL;
const ignoreProviders = (process.env.OPENROUTER_ANALYSIS_VIDEO_IGNORE_PROVIDERS || process.env.OPENROUTER_MODEL_IGNORE_PROVIDERS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

if (!videoUrl) {
  console.error('Missing video URL argument.');
  console.error('Usage: pnpm exec tsx scripts/test-openrouter-shot-timing.ts "<VIDEO_URL>" ["SOURCE_NAME"]');
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Missing OPENROUTER_API_KEY in environment.');
  process.exit(1);
}

if (!model) {
  console.error('Missing OPENROUTER_MODEL (or OPENROUTER_ANALYSIS_VIDEO_MODEL) in environment.');
  process.exit(1);
}

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'creator_video_analysis_schema_debug',
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
                  ambient: { type: 'string' }
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
            required: ['shot_id', 'timing', 'opening_frame', 'visual', 'audio'],
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

const rawPrompt = `Analyze this creator reference video${sourceName ? ` from "${sourceName}"` : ''} and output a strict JSON shot breakdown in schema_version 2 format.
Requirements:
- Return JSON only, matching the schema.
- Cover the full video timeline with ordered shots.
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
- If a legacy combined sound description is all you can infer, put it in audio.ambient.`;

const summarizeTimingHealth = (analysis: Record<string, unknown>) => {
  const shots = Array.isArray(analysis.shots) ? analysis.shots as Array<Record<string, unknown>> : [];
  const rawTimings = shots.map((shot, index) => {
    const timing = shot.timing && typeof shot.timing === 'object'
      ? shot.timing as Record<string, unknown>
      : {};

    return {
      index: index + 1,
      shot_id: shot.shot_id,
      start_time: timing.start_time,
      end_time: timing.end_time,
      duration_seconds: timing.duration_seconds,
    };
  });

  const allZeroTimes = rawTimings.length > 0
    && rawTimings.every(item => String(item.start_time || '').trim() === '00:00' && String(item.end_time || '').trim() === '00:00');
  const allSixSeconds = rawTimings.length > 0
    && rawTimings.every(item => Number(item.duration_seconds) === 6);

  return {
    rawTimings,
    allZeroTimes,
    allSixSeconds,
  };
};

async function main() {
  console.log('[OpenRouter Timing Test] model:', model);
  console.log('[OpenRouter Timing Test] videoUrl:', videoUrl);
  if (ignoreProviders.length > 0) {
    console.log('[OpenRouter Timing Test] provider.ignore:', ignoreProviders.join(', '));
  }

  const data = await sendOpenRouterChat({
    model,
    response_format: responseFormat as Record<string, unknown>,
    ...(ignoreProviders.length > 0 ? { provider: { ignore: ignoreProviders } } : {}),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: rawPrompt
          },
          {
            type: 'video_url',
            video_url: {
              url: videoUrl
            }
          }
        ]
      }
    ]
  }, {
    maxRetries: 3,
    timeoutMs: 90000
  });

  const parsedResult = creatorVideoAnalysisTestUtils.parseCreatorVideoAnalysisResponse(data);
  if (!parsedResult.ok) {
    console.error('[OpenRouter Timing Test] Failed to parse response:', parsedResult.reason);
    process.exit(2);
  }

  const normalizedAnalysis = normalizeAnalysisToV2(parsedResult.parsed);
  if (!normalizedAnalysis) {
    console.error('[OpenRouter Timing Test] Failed to normalize parsed analysis.');
    process.exit(3);
  }

  const strictValidation = creatorVideoAnalysisTestUtils.validateStrictShotSchema(normalizedAnalysis);
  const timingHealth = summarizeTimingHealth(parsedResult.parsed);
  const rebuiltTimeline = parseCompetitorTimeline(
    normalizedAnalysis as unknown as Record<string, unknown>,
    normalizedAnalysis.video_duration_seconds
  );

  const outputDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'openrouter-shot-timing-output.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    request: {
      model,
      videoUrl,
      sourceName,
      providerIgnore: ignoreProviders,
    },
    rawResponse: data,
    parsedAnalysis: parsedResult.parsed,
    normalizedAnalysis,
    rebuiltTimeline,
    timingHealth,
    strictValidation,
  }, null, 2));

  console.log('[OpenRouter Timing Test] strictValidation:', strictValidation);
  console.log('[OpenRouter Timing Test] output saved to:', outputPath);
  console.log('[OpenRouter Timing Test] video_duration_seconds:', normalizedAnalysis.video_duration_seconds);
  console.log('[OpenRouter Timing Test] shots:', normalizedAnalysis.shots.length);
  console.log('[OpenRouter Timing Test] allZeroTimes:', timingHealth.allZeroTimes);
  console.log('[OpenRouter Timing Test] allSixSeconds:', timingHealth.allSixSeconds);

  console.log('\n[Raw timing from model]');
  timingHealth.rawTimings.forEach((shot) => {
    console.log(
      `shot ${shot.index}: start=${String(shot.start_time)} end=${String(shot.end_time)} duration=${String(shot.duration_seconds)}`
    );
  });

  console.log('\n[Normalized timing]');
  normalizedAnalysis.shots.forEach((shot, index) => {
    console.log(
      `shot ${index + 1}: start=${shot.timing.start_time} end=${shot.timing.end_time} duration=${shot.timing.duration_seconds}`
    );
  });

  console.log('\n[Rebuilt continuous timeline from durations]');
  rebuiltTimeline.shots.forEach((shot, index) => {
    console.log(
      `shot ${index + 1}: start=${shot.startTime} end=${shot.endTime} duration=${shot.durationSeconds}`
    );
  });
}

main().catch((error) => {
  console.error('[OpenRouter Timing Test] Request failed:', error);
  process.exit(9);
});
