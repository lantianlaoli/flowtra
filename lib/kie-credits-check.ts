/**
 * KIE Credits Check Utility
 * Provides server-side KIE credits validation for API endpoints
 */
import { fetchWithRetry } from './fetchWithRetry';
import { KIE_CREDIT_THRESHOLD } from '@/lib/constants';

interface KieCreditsResponse {
  sufficient: boolean;
  currentCredits?: number;
  threshold?: number;
  error?: string;
}

const KIE_CREDIT_CACHE_TTL_MS = 10_000;
let cachedKieCredits: (KieCreditsResponse & { expiresAt: number }) | null = null;

/**
 * Check if KIE credits are sufficient for generation
 * @returns Promise<KieCreditsResponse>
 */
export async function checkKieCredits(): Promise<KieCreditsResponse> {
  try {
    const now = Date.now();
    if (cachedKieCredits && cachedKieCredits.expiresAt > now) {
      const { expiresAt: _expiresAt, ...cached } = cachedKieCredits;
      return cached;
    }

    const kieApiKey = process.env.KIE_API_KEY;
    const threshold = KIE_CREDIT_THRESHOLD;

    if (!kieApiKey) {
      console.error('KIE_API_KEY not configured');
      return {
        sufficient: false,
        error: 'KIE API key not configured'
      };
    }

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/chat/credit', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${kieApiKey}`,
        'Content-Type': 'application/json',
      },
    }, 10, 30000);

    if (!response.ok) {
      console.error('Failed to fetch KIE credits:', response.status, response.statusText);
      return {
        sufficient: false,
        error: `Failed to fetch KIE credits: ${response.status}`
      };
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      console.error('KIE API error:', data.msg);
      return {
        sufficient: false,
        error: data.msg || 'Failed to check KIE credits'
      };
    }

    const currentCredits = data.data || 0;
    const sufficient = currentCredits >= threshold;

    console.log(`KIE Credits Check: ${currentCredits}/${threshold} (sufficient: ${sufficient})`);

    const result = {
      sufficient,
      currentCredits,
      threshold
    };
    cachedKieCredits = {
      ...result,
      expiresAt: now + KIE_CREDIT_CACHE_TTL_MS,
    };

    return result;

  } catch (error) {
    console.error('Error checking KIE credits:', error);
    return {
      sufficient: false,
      error: 'Failed to check KIE credits'
    };
  }
}

export class KieCreditsUnavailableError extends Error {
  currentCredits?: number;
  threshold?: number;

  constructor(message: string, details?: { currentCredits?: number; threshold?: number }) {
    super(message);
    this.name = 'KieCreditsUnavailableError';
    this.currentCredits = details?.currentCredits;
    this.threshold = details?.threshold;
  }
}

export async function assertKieCreditsAvailable(): Promise<void> {
  const creditsCheck = await checkKieCredits();
  if (!creditsCheck.sufficient) {
    throw new KieCreditsUnavailableError(
      creditsCheck.error || 'AI generation service credits are temporarily unavailable.',
      {
        currentCredits: creditsCheck.currentCredits,
        threshold: creditsCheck.threshold,
      }
    );
  }
}

/**
 * Middleware function to check KIE credits and return error response if insufficient
 * @returns Promise<Response | null> - Returns error response if insufficient, null if sufficient
 */
export async function validateKieCredits(): Promise<Response | null> {
  const creditsCheck = await checkKieCredits();
  
  if (!creditsCheck.sufficient) {
    return new Response(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'AI generation services are currently under maintenance. Please try again later.',
        code: 'MAINTENANCE_MODE',
        details: creditsCheck.error
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  return null;
}
