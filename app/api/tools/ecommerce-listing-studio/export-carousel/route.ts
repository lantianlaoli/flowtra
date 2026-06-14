import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_EXPORT_IMAGES = 12;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

type ExportImage = {
  url?: string;
  fileName?: string;
};

function safeName(value: string, fallback: string) {
  const name = value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return name || fallback;
}

function extensionFromContentType(contentType: string | null) {
  if (contentType?.includes('jpeg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('png')) return 'png';
  return 'png';
}

function isPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1'
  ) {
    return true;
  }

  const parts = normalized.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function parsePublicImageUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (isPrivateHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { images?: ExportImage[]; fileName?: string };
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_EXPORT_IMAGES) : [];

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images to export.' }, { status: 400 });
    }

    const zip = new JSZip();
    let exportedCount = 0;
    let skippedCount = 0;

    await Promise.all(
      images.map(async (image, index) => {
        const url = parsePublicImageUrl(image.url);
        if (!url) {
          skippedCount += 1;
          return;
        }

        try {
          const response = await fetch(url, {
            headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8' },
          });
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

          const contentType = response.headers.get('content-type');
          if (contentType && !contentType.toLowerCase().startsWith('image/')) {
            throw new Error(`Unsupported content type: ${contentType}`);
          }

          const bytes = await response.arrayBuffer();
          if (bytes.byteLength > MAX_IMAGE_BYTES) {
            throw new Error('Image is too large to export.');
          }

          const extension = extensionFromContentType(contentType);
          const baseName = safeName(image.fileName ?? `carousel-${index + 1}`, `carousel-${index + 1}`).replace(/\.[a-z0-9]+$/i, '');
          zip.file(`${baseName}.${extension}`, bytes);
          exportedCount += 1;
        } catch (error) {
          skippedCount += 1;
          console.warn('[ecommerce-listing-studio/export-carousel] Skipped image:', error);
        }
      })
    );

    if (exportedCount === 0) {
      return NextResponse.json({ error: 'Unable to export images. Please try saving them individually.' }, { status: 502 });
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
    const fileName = safeName(body.fileName ?? 'ecommerce-carousel-images.zip', 'ecommerce-carousel-images.zip');

    return new Response(zipBlob, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName.endsWith('.zip') ? fileName : `${fileName}.zip`}"`,
        'X-Exported-Count': String(exportedCount),
        'X-Skipped-Count': String(skippedCount),
      },
    });
  } catch (error) {
    console.error('[ecommerce-listing-studio/export-carousel] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export images.' },
      { status: 500 }
    );
  }
}
