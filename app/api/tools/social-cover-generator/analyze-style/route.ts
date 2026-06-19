import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeSocialCoverStyleFromImage } from '@/lib/tools/social-cover-generator';

export const runtime = 'nodejs';
export const maxDuration = 120;

const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,/i;

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_DATA_URL_PATTERN.test(value.trim());
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!isImageDataUrl(body.imageDataUrl)) {
      return NextResponse.json({ error: 'Upload a PNG, JPG, or WEBP cover image.' }, { status: 400 });
    }

    const analysis = await analyzeSocialCoverStyleFromImage(body.imageDataUrl);
    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('[tools/social-cover-generator/analyze-style] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze cover style.' },
      { status: 500 }
    );
  }
}
