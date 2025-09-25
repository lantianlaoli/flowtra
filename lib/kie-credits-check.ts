/**
 * KIE Credits Check Utility
 * Provides server-side KIE credits validation for API endpoints
 */

interface KieCreditsResponse {
  sufficient: boolean;
  currentCredits?: number;
  threshold?: number;
  error?: string;
}

/**
 * Check if KIE credits are sufficient for generation
 * @returns Promise<KieCreditsResponse>
 */
export async function checkKieCredits(): Promise<KieCreditsResponse> {
  try {
    const kieApiKey = process.env.KIE_API_KEY;
    const threshold = parseInt(process.env.KIE_CREDIT_THRESHOLD || '600');

    if (!kieApiKey) {
      console.error('KIE_API_KEY not configured');
      return {
        sufficient: false,
        error: 'KIE API key not configured'
      };
    }

    const response = await fetch('https://api.kie.ai/api/v1/user/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${kieApiKey}`,
        'Content-Type': 'application/json',
      },
    });

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

    const currentCredits = data.data?.credits || 0;
    const sufficient = currentCredits >= threshold;

    console.log(`KIE Credits Check: ${currentCredits}/${threshold} (sufficient: ${sufficient})`);

    return {
      sufficient,
      currentCredits,
      threshold
    };

  } catch (error) {
    console.error('Error checking KIE credits:', error);
    return {
      sufficient: false,
      error: 'Failed to check KIE credits'
    };
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