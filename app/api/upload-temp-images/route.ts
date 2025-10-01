import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files: File[] = [];

    // Collect all files from form data
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate all files are images
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'All files must be images' }, { status: 400 });
      }
    }

    // Upload all files to Supabase Storage
    const uploadPromises = files.map(file => uploadImageToStorage(file));
    const uploadResults = await Promise.all(uploadPromises);

    // Extract image URLs
    const imageUrls = uploadResults.map(result => result.fullUrl);

    console.log(`✅ Uploaded ${imageUrls.length} temporary images successfully`);

    return NextResponse.json({
      success: true,
      imageUrls: imageUrls,
      message: `${imageUrls.length} image(s) uploaded successfully`
    });
  } catch (error) {
    console.error('Upload temp images error:', error);
    return NextResponse.json(
      { error: 'File upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
