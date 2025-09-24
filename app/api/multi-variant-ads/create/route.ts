import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startMultiVariantItems } from '@/lib/multi-variant-ads-workflow';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
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
    } = requestData;

    // 添加调试日志，显示请求数据
    console.log('🚀 Multi-variant ads workflow request received:', {
      imageUrl,
      userId,
      videoModel,
      imageModel,
      elementsCount,
      adCopy: adCopy ? '(provided)' : '(not provided)',
      textWatermark,
      textWatermarkLocation,
      imageSize,
      generateVideo,
      photoOnly: !generateVideo,
      elementsData: elementsData ? '(provided)' : '(not provided)'
    });

    if (!imageUrl) return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    const shouldGenerateVideo = generateVideo !== false;
    if (shouldGenerateVideo && !videoModel) {
      return NextResponse.json({ error: 'Video model is required when generating video' }, { status: 400 });
    }

    console.log('📋 Calling startMultiVariantItems...');
    const result = await startMultiVariantItems({
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
      generateVideo,
      photoOnly: !generateVideo // 设置photoOnly为generateVideo的反值
    });
    
    console.log('📊 startMultiVariantItems result:', result);
    
    if (!result.success) {
      console.error('❌ Multi-variant ads workflow failed:', result.error);
      return NextResponse.json({ error: result.error || 'Failed to start multi-variant ads' }, { status: 500 });
    }
    
    console.log('✅ Multi-variant ads workflow started successfully with projectIds:', result.projectIds);
    return NextResponse.json({ success: true, itemIds: result.projectIds });
  } catch (e) {
    console.error('❌ Exception in Multi-variant ads workflow:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}