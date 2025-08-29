import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadImageToStorage } from '@/lib/supabase';
import { startWorkflowProcess } from '@/lib/workflow';
import { getUserCredits } from '@/lib/credits';
import { getActualModel } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawVideoModel = formData.get('videoModel') as string || 'veo3_fast';
    
    // Intelligent model selection for auto mode based on user credits
    let videoModel = rawVideoModel;
    if (rawVideoModel === 'auto') {
      if (userId) {
        // Get user's current credits to determine best model
        const creditsResult = await getUserCredits(userId);
        const userCredits = creditsResult.success ? (creditsResult.credits?.credits_remaining || 0) : 0;
        
        // Use intelligent model selection based on credits
        const selectedModel = getActualModel('auto', userCredits);
        if (!selectedModel) {
          return NextResponse.json({ 
            error: 'Insufficient credits for any video model', 
            details: `You have ${userCredits} credits, but need at least 30 credits for VEO3 Fast` 
          }, { status: 400 });
        }
        videoModel = selectedModel;
      } else {
        // For guest users, default to the cheapest model
        videoModel = 'veo3_fast';
      }
    }
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadImageToStorage(file);

    let historyId = null;
    let workflowStarted = false;
    let workflowResult: { success: boolean; historyId?: string; remainingCredits?: number; creditsUsed?: number; error?: string; details?: string } | null = null;

    // Always start background workflow after upload
    try {
      console.log('Starting workflow process directly...');
      workflowResult = await startWorkflowProcess({
        imageUrl: uploadResult.fullUrl,
        userId: userId || undefined,
        videoModel: videoModel as 'veo3' | 'veo3_fast'
      });

      if (workflowResult.success) {
        historyId = workflowResult.historyId;
        workflowStarted = true;
        console.log('Background workflow started successfully:', workflowResult);
      } else {
        console.error('Failed to start background workflow:', workflowResult.error, workflowResult.details);
      }
    } catch (workflowError) {
      console.error('Error starting background workflow:', workflowError);
      // Continue with upload success even if workflow fails to start
    }

    return NextResponse.json({
      success: true,
      fileUrl: uploadResult.fullUrl,
      publicUrl: uploadResult.publicUrl,
      path: uploadResult.path,
      workflowStarted: workflowStarted,
      historyId: historyId,
      remainingCredits: workflowResult?.remainingCredits,
      creditsUsed: workflowResult?.creditsUsed,
      message: workflowStarted ? 
        'Upload completed and background processing started' : 
        'Upload completed but background processing failed to start'
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'File upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}