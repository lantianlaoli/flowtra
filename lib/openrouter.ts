import { OpenRouter } from '@openrouter/sdk';
import type { RetryConfig } from '@openrouter/sdk/lib/retries';
import type { ChatGenerationParams } from '@openrouter/sdk/models/chatgenerationparams';
import type { ChatResponse } from '@openrouter/sdk/models/chatresponse';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

type LegacyChatContentPart =
  | string
  | {
      type?: string;
      text?: unknown;
      content?: unknown;
      image_url?: { url?: string };
      video_url?: { url?: string };
      imageUrl?: { url?: string };
      videoUrl?: { url?: string };
      [key: string]: unknown;
    };

type LegacyChatRequest = Record<string, unknown>;

type OpenRouterChatOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: HeadersInit;
  httpReferer?: string;
  xTitle?: string;
};

const DEFAULT_INITIAL_RETRY_INTERVAL_MS = 1000;
const DEFAULT_MAX_RETRY_INTERVAL_MS = 5000;
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

let client: OpenRouter | null = null;

const KEY_MAPPINGS: Record<string, string> = {
  response_format: 'responseFormat',
  json_schema: 'jsonSchema',
  image_url: 'imageUrl',
  video_url: 'videoUrl',
  http_referer: 'httpReferer',
  x_title: 'xTitle',
  allow_fallbacks: 'allowFallbacks',
  require_parameters: 'requireParameters',
  data_collection: 'dataCollection',
  enforce_distillable_text: 'enforceDistillableText',
  max_price: 'maxPrice',
  preferred_min_throughput: 'preferredMinThroughput',
  preferred_max_latency: 'preferredMaxLatency',
  frequency_penalty: 'frequencyPenalty',
  logit_bias: 'logitBias',
  top_logprobs: 'topLogprobs',
  max_completion_tokens: 'maxCompletionTokens',
  max_tokens: 'maxTokens',
  presence_penalty: 'presencePenalty',
  parallel_tool_calls: 'parallelToolCalls',
  tool_choice: 'toolChoice',
  top_p: 'topP',
  stream_options: 'streamOptions',
  image_config: 'imageConfig',
  session_id: 'sessionId'
};

function getRetryConfig(maxRetries?: number): RetryConfig | undefined {
  if (!maxRetries || maxRetries <= 0) {
    return undefined;
  }

  return {
    strategy: 'backoff',
    retryConnectionErrors: true,
    backoff: {
      initialInterval: DEFAULT_INITIAL_RETRY_INTERVAL_MS,
      maxInterval: DEFAULT_MAX_RETRY_INTERVAL_MS,
      exponent: 2,
      maxElapsedTime: DEFAULT_MAX_RETRY_INTERVAL_MS * Math.max(1, maxRetries),
    }
  };
}

function normalizeContentPart(part: LegacyChatContentPart): LegacyChatContentPart {
  if (typeof part === 'string') {
    return part;
  }

  if (!part || typeof part !== 'object') {
    return part;
  }

  const normalized = normalizeOpenRouterPayload(part) as LegacyChatContentPart;
  if (typeof normalized === 'object' && normalized && normalized.type === 'input_text') {
    normalized.type = 'text';
  }

  return normalized;
}

function normalizeOpenRouterPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeOpenRouterPayload(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(input)) {
    const normalizedKey = KEY_MAPPINGS[key] ?? key;
    const normalizedValue = normalizedKey === 'messages' && Array.isArray(rawValue)
      ? rawValue.map((message) => {
          if (!message || typeof message !== 'object') return message;
          const messageRecord = normalizeOpenRouterPayload(message) as Record<string, unknown>;
          if (Array.isArray(messageRecord.content)) {
            messageRecord.content = messageRecord.content.map(item => normalizeContentPart(item as LegacyChatContentPart));
          }
          return messageRecord;
        })
      : normalizeOpenRouterPayload(rawValue);

    output[normalizedKey] = normalizedValue;
  }

  if (output.type === 'input_text') {
    output.type = 'text';
  }

  return output;
}

export function getOpenRouterClient(): OpenRouter {
  if (client) {
    return client;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  client = new OpenRouter({ apiKey });
  return client;
}

function isResponseValidationFailure(error: unknown): error is Error & { rawResponse?: Response } {
  if (!(error instanceof Error)) return false;
  // Match both ResponseValidationError and SDKValidationError from @openrouter/sdk
  if (error.name === 'ResponseValidationError' || error.name === 'SDKValidationError') return true;
  // Safely access message — it may be a getter-only property on some SDK error subclasses
  let msg = '';
  try { msg = error.message; } catch { /* ignore getter errors */ }
  return msg.includes('Response validation failed') || msg.includes('validation');
}

async function sendOpenRouterChatWithRawFetch(
  request: LegacyChatRequest,
  options: OpenRouterChatOptions
): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Content-Type', 'application/json');
  if (options.httpReferer) {
    headers.set('HTTP-Referer', options.httpReferer);
  }
  if (options.xTitle) {
    headers.set('X-Title', options.xTitle);
  }

  const response = await fetchWithRetry(
    OPENROUTER_CHAT_URL,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    },
    options.maxRetries ?? 1,
    options.timeoutMs ?? 45000
  );

  const responseText = await response.text();
  let data: unknown = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(`Failed to parse OpenRouter fallback response: ${responseText.slice(0, 400)}`);
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in (data as Record<string, unknown>)
      ? JSON.stringify((data as Record<string, unknown>).error)
      : responseText;
    throw new Error(`OpenRouter request failed (${response.status}): ${message}`);
  }

  return data as ChatResponse;
}

export async function sendOpenRouterChat(
  request: LegacyChatRequest,
  options: OpenRouterChatOptions = {}
): Promise<ChatResponse> {
  const normalizedRequest = normalizeOpenRouterPayload(request) as Record<string, unknown>;
  const operationHttpReferer = typeof normalizedRequest.httpReferer === 'string' ? normalizedRequest.httpReferer : undefined;
  const operationXTitle = typeof normalizedRequest.xTitle === 'string' ? normalizedRequest.xTitle : undefined;
  delete normalizedRequest.httpReferer;
  delete normalizedRequest.xTitle;
  const resolvedHeaders = new Headers(options.headers);
  if (Array.from(resolvedHeaders.keys()).length === 0) {
    resolvedHeaders.set('Content-Type', 'application/json');
  }

  const resolvedOptions: OpenRouterChatOptions = {
    ...options,
    httpReferer: typeof options.httpReferer === 'string'
      ? options.httpReferer
      : operationHttpReferer,
    xTitle: typeof options.xTitle === 'string'
      ? options.xTitle
      : operationXTitle,
    headers: resolvedHeaders
  };

  try {
    return await getOpenRouterClient().chat.send(
      {
        httpReferer: resolvedOptions.httpReferer,
        xTitle: resolvedOptions.xTitle,
        chatGenerationParams: normalizedRequest as ChatGenerationParams
      },
      {
        timeoutMs: options.timeoutMs,
        retries: getRetryConfig(options.maxRetries),
        headers: resolvedHeaders
      }
    ) as ChatResponse;
  } catch (error) {
    if (!isResponseValidationFailure(error)) {
      throw error;
    }

    console.warn('[openrouter] SDK response validation failed, falling back to raw fetch:', error.message);
    return sendOpenRouterChatWithRawFetch(request, resolvedOptions);
  }
}

const getChunkText = (chunk: LegacyChatContentPart): string => {
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

export function extractOpenRouterTextContent(content: unknown): string | null {
  if (!content) return null;

  if (typeof content === 'string') {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const combined = content
      .map(chunk => getChunkText(chunk as LegacyChatContentPart))
      .filter(Boolean)
      .join('\n')
      .trim();

    return combined || null;
  }

  if (typeof content === 'object') {
    const directText = getChunkText(content as LegacyChatContentPart);
    return directText.trim() || null;
  }

  return null;
}

function extractJsonObjectFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;

  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Fall through to best-effort extraction.
  }

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
}

export function extractOpenRouterJsonContent<T>(content: unknown): T | null {
  const text = extractOpenRouterTextContent(content);
  if (!text) return null;

  const jsonText = extractJsonObjectFromText(text);
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}
