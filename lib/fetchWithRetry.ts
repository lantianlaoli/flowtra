const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return { ...(headers as Record<string, string>) };
};

/**
 * Fetch with retry mechanism for handling network issues
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 5, // Increased from 3 to 5
  timeoutMs = 60000 // Increased from 30000 to 60000 (60 seconds)
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const baseHeaders = normalizeHeaders(options.headers);
    const headers = typeof window === 'undefined'
      ? {
          ...baseHeaders,
          Connection: baseHeaders.Connection ?? 'keep-alive',
          'Accept-Encoding': baseHeaders['Accept-Encoding'] ?? 'gzip, deflate',
        }
      : baseHeaders;
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;
      console.warn(`Fetch attempt ${attempt}/${maxRetries} failed for ${url}:`, {
        error: error instanceof Error ? error.message : String(error),
        code: error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : undefined,
        cause: error && typeof error === 'object' && 'cause' in error ? (error as { cause: unknown }).cause : undefined
      });
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying with progressive delays, optimized for image download issues
      let baseDelay = 1000;
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      
      // Longer delay for image timeout issues
      if (errorMessage.includes('timeout') || errorMessage.includes('invalid_image_url')) {
        baseDelay = 2000;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 5000);
      console.log(`Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Handle common network errors and return appropriate error responses
 */
export function getNetworkErrorResponse(error: unknown) {
  if (error instanceof Error) {
    const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : undefined;
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('eai_again') || errorCode === 'EAI_AGAIN') {
      return { error: 'DNS resolution failed. Please check your internet connection.', status: 503 };
    }
    if (errorMessage.includes('etimedout') || errorCode === 'ETIMEDOUT') {
      return { error: 'Request timed out. The service may be temporarily slow.', status: 504 };
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      return { error: 'Request timed out. Please try again.', status: 504 };
    }
    if (errorMessage.includes('invalid_image_url')) {
      return { error: 'Image URL timeout or invalid. Please check the image URL.', status: 504 };
    }
    if (errorMessage.includes('enotfound') || errorCode === 'ENOTFOUND') {
      return { error: 'Service temporarily unavailable. Please try again.', status: 503 };
    }
    if (errorMessage.includes('econnrefused') || errorCode === 'ECONNREFUSED') {
      return { error: 'Cannot connect to the service. Please try again later.', status: 503 };
    }
    if (errorMessage.includes('network')) {
      return { error: 'Network error. Please check your connection.', status: 503 };
    }
  }
  
  return { 
    error: 'Service temporarily unavailable', 
    details: (error as Error).message,
    status: 503 
  };
}
