import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadImageToStorage } from '@/lib/supabase';
import { enforceRateLimit, getRequestIp, RateLimitError } from '@/lib/security/rate-limit';

export const experimental_bodySizeLimit = 20 * 1024 * 1024; // 20MB limit for image uploads

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    enforceRateLimit({
      key: `upload-temp-images:${userId}:${getRequestIp(request)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

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
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Each file must be 10MB or smaller' }, { status: 400 });
      }
    }

    // Upload all files to Supabase Storage
    const uploadPromises = files.map(file => uploadImageToStorage(file, undefined, userId));
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
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds) },
        }
      );
    }

    console.error('Upload temp images error:', error);
    return NextResponse.json(
      { error: 'File upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
