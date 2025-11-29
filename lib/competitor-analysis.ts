import { analyzeCompetitorAdWithLanguage } from '@/lib/standard-ads-workflow';

type CompetitorAnalysisParams = {
  file_url: string;
  file_type: 'image' | 'video';
  competitor_name: string;
};

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  loggerPrefix?: string;
};

export async function analyzeCompetitorAdWithRetry(
  params: CompetitorAnalysisParams,
  options?: RetryOptions
) {
  const attempts = options?.maxAttempts && options.maxAttempts > 0 ? options.maxAttempts : 3;
  const baseDelay = options?.baseDelayMs && options.baseDelayMs > 0 ? options.baseDelayMs : 2000;
  const label = options?.loggerPrefix || 'CompetitorAnalysis';

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`[${label}] Analysis attempt ${attempt}/${attempts}...`);
      return await analyzeCompetitorAdWithLanguage(params);
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
    : new Error('Competitor analysis failed after retries');
}
