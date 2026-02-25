#!/usr/bin/env node

/**
 * OpenRouter video_url analysis smoke test.
 *
 * Usage:
 *   node scripts/test-openrouter-video-analysis.mjs "<VIDEO_URL>"
 *
 * Required env:
 *   OPENROUTER_API_KEY
 *   OPENROUTER_ANALYSIS_VIDEO_MODEL
 *
 * Optional env:
 *   OPENROUTER_ANALYSIS_VIDEO_IGNORE_PROVIDERS="alibaba,deepinfra"
 */

const videoUrl = process.argv[2];
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_ANALYSIS_VIDEO_MODEL;
const ignoreProviders = (process.env.OPENROUTER_ANALYSIS_VIDEO_IGNORE_PROVIDERS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

if (!videoUrl) {
  console.error('Missing video URL argument.');
  console.error('Usage: node scripts/test-openrouter-video-analysis.mjs "<VIDEO_URL>"');
  process.exit(1);
}

if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY.');
  process.exit(1);
}

if (!model) {
  console.error('Missing OPENROUTER_ANALYSIS_VIDEO_MODEL.');
  process.exit(1);
}

const responseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'creator_video_analysis_schema_test',
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
};

const body = {
  model,
  response_format: responseFormat,
  ...(ignoreProviders.length > 0 ? { provider: { ignore: ignoreProviders } } : {}),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analyze this video and return JSON only, following the provided schema.'
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
};

const summarize = (value, max = 600) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
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
];

const parseJsonContent = (content) => {
  if (typeof content === 'string') {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1]?.trim() || trimmed;
    return JSON.parse(candidate);
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (typeof part === 'string' ? part : (part?.text || part?.content || '')))
      .join('\n')
      .trim();
    if (!joined) throw new Error('Empty array content');
    return JSON.parse(joined);
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return JSON.parse(content.text);
    if (typeof content.content === 'string') return JSON.parse(content.content);
  }
  throw new Error(`Unsupported content type: ${typeof content}`);
};

const validateStrictShots = (analysis) => {
  if (!analysis || typeof analysis !== 'object') {
    return { ok: false, reason: 'analysis is not an object' };
  }
  if (!Array.isArray(analysis.shots) || analysis.shots.length === 0) {
    return { ok: false, reason: 'shots is missing or empty' };
  }
  for (let i = 0; i < analysis.shots.length; i += 1) {
    const shot = analysis.shots[i];
    if (!shot || typeof shot !== 'object') {
      return { ok: false, reason: `shot ${i + 1} is not an object` };
    }
    for (const key of REQUIRED_SHOT_FIELDS) {
      if (!(key in shot)) {
        return { ok: false, reason: `shot ${i + 1} missing field "${key}"` };
      }
    }
    for (const key of [
      'first_frame_description',
      'subject',
      'context_environment',
      'action',
      'style',
      'camera_motion_positioning',
      'composition',
      'ambiance_colour_lighting',
      'audio',
    ]) {
      const value = shot[key];
      if (typeof value !== 'string' || !value.trim()) {
        return { ok: false, reason: `shot ${i + 1} empty "${key}"` };
      }
    }
  }
  return { ok: true };
};

async function main() {
  console.log('[Test] Starting OpenRouter video analysis request');
  console.log('[Test] model:', model);
  console.log('[Test] videoUrl:', videoUrl);
  if (ignoreProviders.length > 0) {
    console.log('[Test] provider.ignore:', ignoreProviders.join(', '));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Keep null; print raw text preview below.
  }

  console.log('[Test] status:', res.status);
  console.log('[Test] content-type:', res.headers.get('content-type'));

  if (!json) {
    console.log('[Test] non-JSON body preview:', summarize(text));
    process.exit(2);
  }

  if (json.error) {
    console.log('[Test] API returned error object:');
    console.log(JSON.stringify(json.error, null, 2));
    process.exit(3);
  }

  const choice = json.choices?.[0];
  if (!choice?.message?.content) {
    console.log('[Test] Missing choices/message/content. Full body preview:');
    console.log(summarize(json));
    process.exit(4);
  }

  let analysis = null;
  try {
    analysis = parseJsonContent(choice.message.content);
  } catch (error) {
    console.log('[Test] Failed to parse message content as JSON:');
    console.log(error instanceof Error ? error.message : String(error));
    console.log('[Test] content preview:', summarize(choice.message.content));
    process.exit(6);
  }

  const strictCheck = validateStrictShots(analysis);
  if (!strictCheck.ok) {
    console.log('[Test] Strict shot schema validation FAILED:');
    console.log(strictCheck.reason);
    console.log('[Test] analysis preview:', summarize(analysis));
    process.exit(7);
  }

  console.log('[Test] Strict shot schema validation PASSED');
  console.log('[Test] shots_count:', Array.isArray(analysis.shots) ? analysis.shots.length : 0);
  console.log('[Test] first_shot_preview:', summarize(analysis.shots?.[0] || {}));
}

main().catch((error) => {
  console.error('[Test] Request failed:', error instanceof Error ? error.message : error);
  process.exit(5);
});
