import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadImageToStorage } from '@/lib/supabase';
import { enforceRateLimit, getRequestIp, RateLimitError } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    enforceRateLimit({
      key: `upload:${userId}:${getRequestIp(request)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be 10MB or smaller' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadImageToStorage(file, undefined, userId);

    // Only upload the file, don't start workflow yet
    // The workflow will be started later via the appropriate ads API with watermark config
    console.log('File uploaded successfully, waiting for user configuration...');

    return NextResponse.json({
      success: true,
      fileUrl: uploadResult.fullUrl,
      publicUrl: uploadResult.publicUrl,
      path: uploadResult.path,
      workflowStarted: false,
      message: 'Upload completed successfully. Please configure your advertisement settings.'
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds) },
        }
      );
    }

    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'File upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
