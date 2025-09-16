import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startV2Items } from '@/lib/workflow-v2';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, userId, videoModel, elementsCount, textWatermark, textWatermarkLocation, imageSize } = await request.json();

    if (!imageUrl) return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    if (!videoModel) return NextResponse.json({ error: 'Video model is required' }, { status: 400 });

    const result = await startV2Items({
      imageUrl,
      userId,
      videoModel,
      elementsCount,
      textWatermark,
      textWatermarkLocation,
      imageSize
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to start V2 items' }, { status: 500 });
    }
    return NextResponse.json({ success: true, itemIds: result.itemIds });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

