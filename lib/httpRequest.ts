import https from 'https';

interface HttpRequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * Alternative HTTP request using Node.js native https module
 * This can be more reliable in some network environments
 */
export function httpRequest(url: string, options: HttpRequestOptions): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const timeout = options.timeout || 15000;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: {
        ...options.headers,
        'Content-Length': options.body ? Buffer.byteLength(options.body) : 0,
      },
      timeout,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * HTTP request with retry using native Node.js https
 */
export async function httpRequestWithRetry(
  url: string,
  options: HttpRequestOptions,
  maxRetries = 3
): Promise<{ status: number; data: string }> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await httpRequest(url, {
        ...options,
        timeout: 10000 // Shorter timeout for native requests
      });
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`HTTP request attempt ${attempt}/${maxRetries} failed for ${url}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Shorter delays for native requests
      const delay = Math.min(500 * Math.pow(1.5, attempt - 1), 2000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}