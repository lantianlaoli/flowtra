'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, RotateCcw } from 'lucide-react';

interface RetryImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  width?: number;
  height?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export default function RetryImage({
  src,
  alt,
  fill,
  className,
  sizes,
  width,
  height,
  maxRetries = 5,
  retryDelay = 2000,
}: RetryImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setCurrentSrc(src);
    setRetryCount(0);
    setIsLoading(true);
    setHasError(false);
    setIsRetrying(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    setIsRetrying(false);
  };

  const handleError = () => {
    setIsLoading(false);

    if (retryCount < maxRetries) {
      setIsRetrying(true);

      // Retry with exponential backoff
      const delay = retryDelay * Math.pow(1.5, retryCount);

      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Add cache busting parameter to force reload
        const url = new URL(currentSrc);
        url.searchParams.set('retry', retryCount.toString());
        url.searchParams.set('t', Date.now().toString());
        setCurrentSrc(url.toString());
        setIsLoading(true);
        setIsRetrying(false);
      }, delay);
    } else {
      setHasError(true);
      setIsRetrying(false);
    }
  };

  const handleManualRetry = () => {
    if (retryCount < maxRetries * 2) { // Allow more manual retries
      setRetryCount(prev => prev + 1);
      setHasError(false);
      setIsLoading(true);
      setIsRetrying(false);

      // Add cache busting parameter
      const url = new URL(src);
      url.searchParams.set('manual', retryCount.toString());
      url.searchParams.set('t', Date.now().toString());
      setCurrentSrc(url.toString());
    }
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-100 text-gray-500">
        <RotateCcw className="w-8 h-8 mb-2" />
        <p className="text-sm font-medium mb-2">Image failed to load</p>
        <p className="text-xs text-gray-400 mb-3">
          Tried {retryCount} times
        </p>
        <button
          onClick={handleManualRetry}
          disabled={retryCount >= maxRetries * 2}
          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          {retryCount >= maxRetries * 2 ? 'Max retries reached' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {(isLoading || isRetrying) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            {isRetrying && (
              <p className="text-xs text-gray-500">
                Retrying... ({retryCount}/{maxRetries})
              </p>
            )}
          </div>
        </div>
      )}

      <Image
        src={currentSrc}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        className={className}
        sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
        unoptimized={retryCount > 0} // Bypass Next.js optimization on retries
      />
    </div>
  );
}