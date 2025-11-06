import Image, { ImageProps } from 'next/image';
import { getSimpleBlurDataURL } from '@/lib/get-blur-data-url';

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  /**
   * Whether to use blur placeholder
   * @default true for non-priority images
   */
  useBlur?: boolean;
  /**
   * Fallback blur color (hex without #)
   * @default 'f3f4f6' (gray-100)
   */
  blurColor?: string;
  /**
   * Pre-generated blur data URL (use for high-quality blur)
   * If not provided, will use simple SVG blur
   */
  blurDataURL?: string;
}

/**
 * Optimized Image Component
 *
 * Automatically applies:
 * - Lazy loading for non-priority images
 * - Blur placeholders (simple SVG or custom)
 * - Quality optimization defaults
 * - AVIF/WebP format optimization via Next.js
 *
 * @example
 * ```tsx
 * // Basic usage (auto lazy + blur)
 * <OptimizedImage src="/image.jpg" alt="Description" width={800} height={600} />
 *
 * // Priority image (no lazy, no blur)
 * <OptimizedImage src="/hero.jpg" alt="Hero" width={1200} height={800} priority />
 *
 * // Custom blur color
 * <OptimizedImage src="/image.jpg" alt="Description" width={800} height={600} blurColor="e5e7eb" />
 *
 * // Pre-generated high-quality blur
 * <OptimizedImage
 *   src="/image.jpg"
 *   alt="Description"
 *   width={800}
 *   height={600}
 *   blurDataURL={preGeneratedBlur}
 * />
 * ```
 */
export default function OptimizedImage({
  useBlur,
  blurColor = 'f3f4f6',
  blurDataURL,
  priority = false,
  loading,
  quality = 85,
  sizes,
  ...props
}: OptimizedImageProps) {
  // Determine if we should use blur
  const shouldUseBlur = useBlur ?? !priority;

  // Generate simple SVG blur if needed and not provided
  let finalBlurDataURL: string | undefined = blurDataURL;
  if (shouldUseBlur && !blurDataURL) {
    const width = typeof props.width === 'number' ? props.width : 100;
    const height = typeof props.height === 'number' ? props.height : 100;
    finalBlurDataURL = getSimpleBlurDataURL(width, height, blurColor);
  }

  // Priority images should not be lazy loaded
  const imageLoading = priority ? undefined : (loading ?? 'lazy');

  // Default responsive sizes if not provided
  const defaultSizes = sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  return (
    <Image
      {...props}
      alt={props.alt} // Explicitly pass alt for ESLint
      priority={priority}
      loading={imageLoading}
      quality={quality}
      sizes={defaultSizes}
      placeholder={finalBlurDataURL ? 'blur' : 'empty'}
      blurDataURL={finalBlurDataURL}
    />
  );
}
