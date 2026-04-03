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

type GatewayChatRequest = Record<string, unknown>;

type GatewayChatOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: HeadersInit;
  httpReferer?: string;
  xTitle?: string;
};

export type GatewayChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
    metadata?: { provider_name?: string };
  };
  [key: string]: unknown;
};

const AI_GATEWAY_CHAT_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

const getGatewayApiKey = () => process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;

function normalizeContentPart(part: LegacyChatContentPart): LegacyChatContentPart {
  if (typeof part === 'string') {
    return part;
  }

  if (!part || typeof part !== 'object') {
    return part;
  }

  const normalized = normalizeAIGatewayPayload(part) as LegacyChatContentPart;
  if (typeof normalized === 'object' && normalized && normalized.type === 'input_text') {
    normalized.type = 'text';
  }

  if (typeof normalized === 'object' && normalized) {
    if ('imageUrl' in normalized && !('image_url' in normalized)) {
      normalized.image_url = normalized.imageUrl as { url?: string };
      delete normalized.imageUrl;
    }
    if ('videoUrl' in normalized && !('video_url' in normalized)) {
      normalized.video_url = normalized.videoUrl as { url?: string };
      delete normalized.videoUrl;
    }
  }

  return normalized;
}

function normalizeAIGatewayPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAIGatewayPayload(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(input)) {
    const normalizedValue = key === 'messages' && Array.isArray(rawValue)
      ? rawValue.map((message) => {
          if (!message || typeof message !== 'object') return message;
          const messageRecord = normalizeAIGatewayPayload(message) as Record<string, unknown>;
          if (Array.isArray(messageRecord.content)) {
            messageRecord.content = messageRecord.content.map((item) => normalizeContentPart(item as LegacyChatContentPart));
          }
          return messageRecord;
        })
      : normalizeAIGatewayPayload(rawValue);

    output[key] = normalizedValue;
  }

  if (output.type === 'input_text') {
    output.type = 'text';
  }

  return output;
}

export async function sendAIGatewayChat(
  request: GatewayChatRequest,
  options: GatewayChatOptions = {}
): Promise<GatewayChatResponse> {
  const apiKey = getGatewayApiKey();
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY is not configured.');
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
    AI_GATEWAY_CHAT_URL,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(normalizeAIGatewayPayload(request)),
    },
    options.maxRetries ?? 1,
    options.timeoutMs ?? 45000
  );

  const responseText = await response.text();
  let data: unknown = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(`Failed to parse AI Gateway response: ${responseText.slice(0, 400)}`);
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in (data as Record<string, unknown>)
      ? JSON.stringify((data as Record<string, unknown>).error)
      : responseText;
    throw new Error(`AI Gateway request failed (${response.status}): ${message}`);
  }

  return data as GatewayChatResponse;
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

export function extractAIGatewayTextContent(content: unknown): string | null {
  if (!content) return null;

  if (typeof content === 'string') {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const combined = content
      .map((chunk) => getChunkText(chunk as LegacyChatContentPart))
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

export function extractAIGatewayJsonContent<T>(content: unknown): T | null {
  const text = extractAIGatewayTextContent(content);
  if (!text) return null;

  const jsonText = extractJsonObjectFromText(text);
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}
