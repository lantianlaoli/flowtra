import { getPlaiceholder } from 'plaiceholder';

/**
 * Generate a blur data URL for an image
 *
 * This function fetches an image and generates a low-quality placeholder
 * using plaiceholder for better perceived performance during image loading.
 *
 * @param src - Image URL (can be remote or local)
 * @returns Base64 encoded blur data URL
 */
export async function getBlurDataURL(src: string): Promise<string> {
  try {
    // For local images
    if (src.startsWith('/')) {
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      const buffer = await readFile(join(process.cwd(), 'public', src));
      const { base64 } = await getPlaiceholder(buffer);
      return base64;
    }

    // For remote images
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { base64 } = await getPlaiceholder(buffer);

    return base64;
  } catch (error) {
    console.error('Error generating blur data URL:', error);
    // Return a simple gray placeholder as fallback
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  }
}

/**
 * Generate blur data URLs for multiple images in parallel
 *
 * @param srcs - Array of image URLs
 * @returns Array of base64 encoded blur data URLs
 */
export async function getBlurDataURLs(srcs: string[]): Promise<string[]> {
  return Promise.all(srcs.map(src => getBlurDataURL(src)));
}

/**
 * Simple inline SVG blur placeholder (no network request needed)
 * Use this for truly static builds or when plaiceholder is not available
 *
 * @param width - Placeholder width
 * @param height - Placeholder height
 * @param color - Placeholder color (hex without #)
 * @returns Data URL for an SVG placeholder
 */
export function getSimpleBlurDataURL(
  width: number = 100,
  height: number = 100,
  color: string = 'f3f4f6'
): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#${color}"/>
    </svg>
  `.trim();

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
