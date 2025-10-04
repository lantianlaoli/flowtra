import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { uploadUserPhotoToStorage, getUserPhotos, deleteUserPhoto } from '@/lib/supabase';

// GET: Fetch all user photos
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const photos = await getUserPhotos(userId);

    return NextResponse.json({
      success: true,
      photos
    });

  } catch (error) {
    console.error('Get user photos error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch photos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Upload a new user photo
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;
  let fileInfo: { name: string; size: number; type: string } | null = null;

  try {
    const { userId: authUserId } = getAuth(request);
    userId = authUserId;

    if (!userId) {
      console.log('[User Photo Upload] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[User Photo Upload] Starting upload for user: ${userId}`);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log(`[User Photo Upload] No file provided by user: ${userId}`);
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type
    };

    console.log(`[User Photo Upload] File info for user ${userId}:`, fileInfo);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log(`[User Photo Upload] Invalid file type: ${file.type} for user: ${userId}`);
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Additional file size validation (8MB)
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log(`[User Photo Upload] File too large: ${file.size} bytes for user: ${userId}`);
      return NextResponse.json({
        error: `File too large. Maximum size is 8MB, received ${(file.size / 1024 / 1024).toFixed(1)}MB`
      }, { status: 400 });
    }

    // Validate file name
    if (file.name.length > 255) {
      console.log(`[User Photo Upload] File name too long for user: ${userId}`);
      return NextResponse.json({ error: 'File name too long' }, { status: 400 });
    }

    console.log(`[User Photo Upload] Starting storage upload for user: ${userId}`);

    // Upload photo to storage and save to database
    const uploadResult = await uploadUserPhotoToStorage(file, userId);

    const duration = Date.now() - startTime;
    console.log(`[User Photo Upload] Success for user ${userId} in ${duration}ms:`, {
      url: uploadResult.publicUrl,
      path: uploadResult.path,
      photoId: uploadResult.photoRecord?.id
    });

    return NextResponse.json({
      success: true,
      photo: uploadResult.photoRecord,
      imageUrl: uploadResult.publicUrl,
      path: uploadResult.path,
      message: 'Photo uploaded successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorDetails = {
      userId,
      fileInfo,
      duration,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : error
    };

    console.error('[User Photo Upload] Error:', errorDetails);

    // Return more specific error messages based on error type
    let statusCode = 500;
    let errorMessage = 'Photo upload failed';

    if (error instanceof Error) {
      // Check for specific Supabase storage errors
      if (error.message.includes('The resource was not found')) {
        statusCode = 404;
        errorMessage = 'Storage bucket not found';
      } else if (error.message.includes('duplicate key')) {
        statusCode = 409;
        errorMessage = 'Photo with this name already exists';
      } else if (error.message.includes('File size too large')) {
        statusCode = 413;
        errorMessage = 'File size exceeds limit';
      } else if (error.message.includes('Invalid file type')) {
        statusCode = 415;
        errorMessage = 'Unsupported file type';
      } else if (error.message.includes('Row-level security')) {
        statusCode = 403;
        errorMessage = 'Permission denied';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        statusCode = 503;
        errorMessage = 'Service temporarily unavailable. Please try again.';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { debug: errorDetails })
      },
      { status: statusCode }
    );
  }
}

// DELETE: Delete a user photo
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    await deleteUserPhoto(photoId, userId);

    console.log('User photo deleted successfully:', photoId);

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully'
    });

  } catch (error) {
    console.error('User photo delete error:', error);
    return NextResponse.json(
      {
        error: 'Photo deletion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

