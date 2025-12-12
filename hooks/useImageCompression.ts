import { useState, useCallback } from 'react';
import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export function useImageCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionError, setCompressionError] = useState<string | null>(null);

  const compressImage = useCallback(async (
    file: File,
    options?: CompressionOptions
  ): Promise<CompressionResult> => {
    const defaultOptions = {
      maxSizeMB: 4, // Target 4MB (below Vercel 4.5MB limit with buffer)
      maxWidthOrHeight: 4096, // Preserve up to 4K resolution
      useWebWorker: true, // Non-blocking compression
      quality: 0.8, // 80% quality (good balance)
      fileType: file.type === 'image/png' ? 'image/jpeg' : file.type, // Convert PNG to JPEG for better compression
      ...options
    };

    setIsCompressing(true);
    setCompressionProgress(0);
    setCompressionError(null);

    try {
      console.log('[useImageCompression] Starting compression:', {
        fileName: file.name,
        originalSize: file.size,
        originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
        options: defaultOptions
      });

      const compressedFile = await imageCompression(file, {
        ...defaultOptions,
        onProgress: (progress) => {
          setCompressionProgress(progress);
          console.log(`[useImageCompression] Compression progress: ${progress}%`);
        }
      });

      const compressionRatio = ((1 - compressedFile.size / file.size) * 100);

      console.log('[useImageCompression] Compression complete:', {
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio: `${compressionRatio.toFixed(1)}%`,
        originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
        compressedSizeMB: (compressedFile.size / 1024 / 1024).toFixed(2)
      });

      setIsCompressing(false);
      setCompressionProgress(100);

      return {
        compressedFile,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio
      };
    } catch (error) {
      console.error('[useImageCompression] Compression failed:', error);
      setIsCompressing(false);
      setCompressionError(error instanceof Error ? error.message : 'Compression failed');
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setIsCompressing(false);
    setCompressionProgress(0);
    setCompressionError(null);
  }, []);

  return {
    compressImage,
    isCompressing,
    compressionProgress,
    compressionError,
    reset
  };
}
