import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadImageToStorage } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawVideoModel = formData.get('videoModel') as string || 'veo3_fast';
    // Convert 'auto' to 'veo3' for database constraints
    const videoModel = rawVideoModel === 'auto' ? 'veo3' : rawVideoModel;
    
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

    // Always start background workflow after upload
    try {
      const workflowResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/start-workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadResult.fullUrl,
          userId: userId,
          videoModel: videoModel as 'veo3' | 'veo3_fast'
        })
      });

      if (workflowResponse.ok) {
        const workflowData = await workflowResponse.json();
        historyId = workflowData.historyId;
        workflowStarted = true;
        console.log('Background workflow started successfully:', workflowData);
      } else {
        const errorData = await workflowResponse.text();
        console.error('Failed to start background workflow:', workflowResponse.status, errorData);
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