type RetryableSupabaseResult = {
  error?: unknown | null;
};

type RunSupabaseQueryWithRetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
};

const TRANSIENT_SUPABASE_PATTERNS = [
  /fetch failed/i,
  /econnreset/i,
  /etimedout/i,
  /enotfound/i,
  /eai_again/i,
  /econnrefused/i,
  /client network socket disconnected/i,
  /tls connection was established/i,
  /network/i,
  /timeout/i,
];

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export function isTransientSupabaseError(error: unknown): boolean {
  if (!error) return false;

  const values: string[] = [];
  if (typeof error === 'string') {
    values.push(error);
  }

  if (error instanceof Error) {
    values.push(error.message);
    const maybeCause = (error as Error & { cause?: unknown }).cause;
    if (typeof maybeCause === 'string') {
      values.push(maybeCause);
    } else if (maybeCause && typeof maybeCause === 'object') {
      values.push(String((maybeCause as { message?: unknown }).message ?? ''));
      values.push(String((maybeCause as { code?: unknown }).code ?? ''));
    }
  }

  if (typeof error === 'object') {
    const record = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    values.push(String(record.message ?? ''));
    values.push(String(record.details ?? ''));
    values.push(String(record.hint ?? ''));
    values.push(String(record.code ?? ''));
    if (typeof record.cause === 'string') {
      values.push(record.cause);
    }
  }

  const haystack = values.join(' ').trim();
  if (!haystack) return false;

  return TRANSIENT_SUPABASE_PATTERNS.some((pattern) => pattern.test(haystack));
}

export async function runSupabaseQueryWithRetry<T extends RetryableSupabaseResult>(
  operation: () => PromiseLike<T>,
  options?: RunSupabaseQueryWithRetryOptions
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const baseDelayMs = Math.max(50, options?.baseDelayMs ?? 150);
  const label = options?.label || 'supabase query';

  let lastResult: T | null = null;
  let lastThrown: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation();
      lastResult = result;
      if (!isTransientSupabaseError(result.error) || attempt === attempts) {
        return result;
      }

      console.warn(`[Supabase Retry] ${label} failed on attempt ${attempt}/${attempts}, retrying...`, result.error);
    } catch (error) {
      lastThrown = error;
      if (!isTransientSupabaseError(error) || attempt === attempts) {
        throw error;
      }

      console.warn(`[Supabase Retry] ${label} threw on attempt ${attempt}/${attempts}, retrying...`, error);
    }

    await sleep(Math.min(baseDelayMs * attempt, 600));
  }

  if (lastResult) {
    return lastResult;
  }

  throw lastThrown ?? new Error(`${label} failed`);
}
