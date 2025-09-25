import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/standard-ads-workflow';
import { validateKieCredits } from '@/lib/kie-credits-check';

export async function POST(request: NextRequest) {
  try {
    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }
    const requestData: StartWorkflowRequest = await request.json();

    // 确保photoOnly字段正确设置为shouldGenerateVideo的反值
    // 如果界面选择了image only，则shouldGenerateVideo应为false，photoOnly应为true
    requestData.photoOnly = requestData.shouldGenerateVideo === undefined ? false : !requestData.shouldGenerateVideo;
    
    // 日志显示photoOnly与用户选择不一致，可能是shouldGenerateVideo传递有问题
    // 如果用户在界面选择了"image only"，确保photoOnly为true
    if (requestData.shouldGenerateVideo === false) {
      requestData.photoOnly = true;
    }
    
    // 修复模型选择问题：确保当选择了nano_banana时不会显示为auto
    if (requestData.imageModel === 'auto') {
      // 默认使用nano_banana作为auto的实际模型
      requestData.imageModel = 'nano_banana';
    }

    console.log('🚀 Standard ads workflow request received:', {
      imageUrl: requestData.imageUrl,
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      imageModel: requestData.imageModel,
      watermark: requestData.watermark,
      watermarkLocation: requestData.watermarkLocation,
      imageSize: requestData.imageSize,
      elementsCount: requestData.elementsCount,
      photoOnly: requestData.photoOnly
    });

    if (!requestData.imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    console.log('📋 Calling startWorkflowProcess...');
    const result = await startWorkflowProcess(requestData);

    console.log('📊 startWorkflowProcess result:', result);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      console.error('❌ Standard ads workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Standard ads API error:', error);
    return NextResponse.json({
      error: 'Failed to start standard ads workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}