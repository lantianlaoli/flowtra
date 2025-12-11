import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadProductPhotoToStorage } from '@/lib/supabase';
import { validateImageFormat } from '@/lib/image-validation';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get file from form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({
        error: 'File is required'
      }, { status: 400 });
    }

    // 3. Validate image format
    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      return NextResponse.json({
        error: validationResult.error
      }, { status: 400 });
    }

    // 4. Upload to storage
    console.log('[temp-upload] Uploading file:', { userId, fileName: file.name, fileSize: file.size });

    const uploadResult = await uploadProductPhotoToStorage(file, userId);

    console.log('[temp-upload] Upload successful:', { userId, publicUrl: uploadResult.publicUrl });

    return NextResponse.json({
      success: true,
      publicUrl: uploadResult.publicUrl,
      path: uploadResult.path
    });

  } catch (error) {
    console.error('[temp-upload] POST error:', error);
    return NextResponse.json({
      error: 'Failed to upload photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
