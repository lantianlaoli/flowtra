import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startV2Items } from '@/lib/multi-variant-ads-workflow';

export async function POST(request: NextRequest) {
  try {
    const {
      imageUrl,
      userId,
      elementsData,
      videoModel,
      imageModel,
      elementsCount,
      adCopy,
      textWatermark,
      textWatermarkLocation,
      imageSize,
      generateVideo
    } = await request.json();

    if (!imageUrl) return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    const shouldGenerateVideo = generateVideo !== false;
    if (shouldGenerateVideo && !videoModel) {
      return NextResponse.json({ error: 'Video model is required when generating video' }, { status: 400 });
    }

    const result = await startV2Items({
      imageUrl,
      userId,
      elementsData,
      videoModel,
      imageModel,
      elementsCount,
      adCopy,
      textWatermark,
      textWatermarkLocation,
      imageSize,
      generateVideo
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to start multi-variant ads' }, { status: 500 });
    }
    return NextResponse.json({ success: true, itemIds: result.itemIds });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}