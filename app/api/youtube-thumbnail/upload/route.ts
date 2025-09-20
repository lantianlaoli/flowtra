import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { uploadIdentityImageToStorage } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Upload identity image to Supabase Storage
    const uploadResult = await uploadIdentityImageToStorage(file, userId);

    console.log('Identity image uploaded successfully:', uploadResult.publicUrl);

    return NextResponse.json({
      success: true,
      imageUrl: uploadResult.publicUrl,
      path: uploadResult.path,
      message: 'Identity image uploaded successfully'
    });

  } catch (error) {
    console.error('Identity image upload error:', error);
    return NextResponse.json(
      {
        error: 'Image upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}