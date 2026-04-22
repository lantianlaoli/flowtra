import 'server-only';

export const CREEM_MODERATION_BLOCKED_MESSAGE =
  'Your prompt could not be processed. Please revise and try again.';

export type CreemModerationDecision = 'allow' | 'flag' | 'deny';

type CreemModerationResponse = {
  id?: unknown;
  object?: unknown;
  prompt?: unknown;
  external_id?: unknown;
  decision?: unknown;
  usage?: unknown;
};

type ModeratePromptOptions = {
  externalId?: string | null;
  timeoutMs?: number;
};

export class CreemModerationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message = CREEM_MODERATION_BLOCKED_MESSAGE, status = 400) {
    super(message);
    this.name = 'CreemModerationError';
    this.code = code;
    this.status = status;
  }
}

function normalizeCreemApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CreemModerationError('creem_moderation_config_missing', undefined, 503);
  }

  const url = new URL(trimmed);
  return url.origin;
}

export function getCreemModerationConfig(): { apiUrl: string; apiKey: string } {
  const isDevMode = process.env.CREEM_ENVIRONMENT === 'development';
  const configuredUrl = isDevMode
    ? process.env.CREEM_API_URL_DEV
    : process.env.CREEM_API_URL_PROD;
  const configuredKey = isDevMode
    ? process.env.CREEM_API_KEY_DEV
    : process.env.CREEM_API_KEY_PROD;

  if (!configuredUrl || !configuredKey) {
    throw new CreemModerationError('creem_moderation_config_missing', undefined, 503);
  }

  return {
    apiUrl: `${normalizeCreemApiBaseUrl(configuredUrl)}/v1/moderation/prompt`,
    apiKey: configuredKey,
  };
}

export function isCreemModerationError(error: unknown): error is CreemModerationError {
  return error instanceof CreemModerationError;
}

export async function moderatePromptBeforeGeneration(
  prompt: string,
  options: ModeratePromptOptions = {}
): Promise<{ decision: CreemModerationDecision; id?: string }> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new CreemModerationError('prompt_required');
  }

  const { apiUrl, apiKey } = getCreemModerationConfig();
  const timeoutMs = options.timeoutMs ?? 5000;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: normalizedPrompt,
        ...(options.externalId ? { external_id: options.externalId } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.warn('[Creem Moderation] Request failed closed:', {
      externalId: options.externalId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new CreemModerationError('creem_moderation_unavailable', undefined, 503);
  }

  if (!response.ok) {
    console.warn('[Creem Moderation] Non-2xx response failed closed:', {
      externalId: options.externalId || null,
      status: response.status,
    });
    throw new CreemModerationError('creem_moderation_http_error', undefined, 503);
  }

  let payload: CreemModerationResponse;
  try {
    payload = (await response.json()) as CreemModerationResponse;
  } catch {
    throw new CreemModerationError('creem_moderation_malformed_response', undefined, 503);
  }

  if (
    payload.decision !== 'allow' &&
    payload.decision !== 'flag' &&
    payload.decision !== 'deny'
  ) {
    throw new CreemModerationError('creem_moderation_unknown_decision', undefined, 503);
  }

  if (payload.decision === 'flag' || payload.decision === 'deny') {
    throw new CreemModerationError(`prompt_${payload.decision}`);
  }

  return {
    decision: payload.decision,
    id: typeof payload.id === 'string' ? payload.id : undefined,
  };
}
