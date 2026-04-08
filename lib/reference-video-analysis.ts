import { analyzeReferenceVideoWithLanguage } from '@/lib/video-clone-workflow';

type ReferenceVideoAnalysisParams = {
  file_url: string;
  file_type: 'image' | 'video';
  reference_name: string;
};

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  loggerPrefix?: string;
};

export async function analyzeReferenceVideoWithRetry(
  params: ReferenceVideoAnalysisParams,
  options?: RetryOptions
) {
  const attempts = options?.maxAttempts && options.maxAttempts > 0 ? options.maxAttempts : 3;
  const baseDelay = options?.baseDelayMs && options.baseDelayMs > 0 ? options.baseDelayMs : 2000;
  const label = options?.loggerPrefix || 'ReferenceVideoAnalysis';

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`[${label}] Analysis attempt ${attempt}/${attempts}...`);
      return await analyzeReferenceVideoWithLanguage(params);
    } catch (error) {
      lastError = error;
      console.warn(`[${label}] Analysis attempt ${attempt} failed:`, error);
      if (attempt >= attempts) {
        break;
      }
      const delay = baseDelay * attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Reference video analysis failed after retries');
}
