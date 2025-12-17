import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { uploadAvatarToStorage, getUserAvatars, deleteAvatar, uploadAvatarFromUrl, updateAvatarName } from '@/lib/supabase';

// GET: Fetch all user avatars
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const avatars = await getUserAvatars(userId);

    return NextResponse.json({
      success: true,
      avatars
    });

  } catch (error) {
    console.error('Get user avatars error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch avatars',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Upload a new user avatar
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;
  let fileInfo: { name: string; size: number; type: string } | null = null;

  try {
    const { userId: authUserId } = getAuth(request);
    userId = authUserId;

    if (!userId) {
      console.log('[Avatar Upload] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      console.log(`[Avatar Upload] JSON request detected for user: ${userId}`);
      const body = await request.json();
      const { imageUrl, avatarName = 'Unnamed Avatar' } = body;

      if (!imageUrl) {
        return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
      }

      const result = await uploadAvatarFromUrl(imageUrl, userId, avatarName);
      return NextResponse.json({
        success: true,
        avatar: result.avatarRecord,
        imageUrl: result.publicUrl,
        path: result.path,
        message: 'Avatar saved successfully'
      });
    }

    console.log(`[Avatar Upload] Starting upload for user: ${userId}`);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const avatarName = (formData.get('avatarName') as string) || 'Unnamed Avatar';

    if (!file) {
      console.log(`[Avatar Upload] No file provided by user: ${userId}`);
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type
    };

    console.log(`[Avatar Upload] File info for user ${userId}:`, fileInfo);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log(`[Avatar Upload] Invalid file type: ${file.type} for user: ${userId}`);
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Additional file size validation (8MB)
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log(`[Avatar Upload] File too large: ${file.size} bytes for user: ${userId}`);
      return NextResponse.json({
        error: `File too large. Maximum size is 8MB, received ${(file.size / 1024 / 1024).toFixed(1)}MB`
      }, { status: 400 });
    }

    // Validate file name
    if (file.name.length > 255) {
      console.log(`[Avatar Upload] File name too long for user: ${userId}`);
      return NextResponse.json({ error: 'File name too long' }, { status: 400 });
    }

    // Validate avatar name
    if (avatarName.length > 255) {
      console.log(`[Avatar Upload] Avatar name too long for user: ${userId}`);
      return NextResponse.json({ error: 'Avatar name too long' }, { status: 400 });
    }

    console.log(`[Avatar Upload] Starting storage upload for user: ${userId}`);

    // Upload avatar to storage and save to database
    const uploadResult = await uploadAvatarToStorage(file, userId, avatarName);

    const duration = Date.now() - startTime;
    console.log(`[Avatar Upload] Success for user ${userId} in ${duration}ms:`, {
      url: uploadResult.publicUrl,
      path: uploadResult.path,
      avatarId: uploadResult.avatarRecord?.id
    });

    return NextResponse.json({
      success: true,
      avatar: uploadResult.avatarRecord,
      imageUrl: uploadResult.publicUrl,
      path: uploadResult.path,
      message: 'Avatar uploaded successfully'
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

    console.error('[Avatar Upload] Error:', errorDetails);

    // Return more specific error messages based on error type
    let statusCode = 500;
    let errorMessage = 'Avatar upload failed';

    if (error instanceof Error) {
      // Check for specific Supabase storage errors
      if (error.message.includes('The resource was not found')) {
        statusCode = 404;
        errorMessage = 'Storage bucket not found';
      } else if (error.message.includes('duplicate key')) {
        statusCode = 409;
        errorMessage = 'Avatar with this name already exists';
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

// PUT: Update avatar name
export async function PUT(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('avatarId');

    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { avatarName } = body;

    if (!avatarName || typeof avatarName !== 'string') {
      return NextResponse.json({ error: 'Avatar name is required' }, { status: 400 });
    }

    if (avatarName.length > 255) {
      return NextResponse.json({ error: 'Avatar name too long (max 255 characters)' }, { status: 400 });
    }

    const updatedAvatar = await updateAvatarName(avatarId, userId, avatarName);

    console.log('Avatar name updated successfully:', avatarId);

    return NextResponse.json({
      success: true,
      avatar: updatedAvatar,
      message: 'Avatar name updated successfully'
    });

  } catch (error) {
    console.error('Avatar update error:', error);
    return NextResponse.json(
      {
        error: 'Avatar update failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a user avatar
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('avatarId');

    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID is required' }, { status: 400 });
    }

    await deleteAvatar(avatarId, userId);

    console.log('User avatar deleted successfully:', avatarId);

    return NextResponse.json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json(
      {
        error: 'Avatar deletion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

