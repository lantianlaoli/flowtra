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

    // Upload photo to storage and save to database
    const uploadResult = await uploadUserPhotoToStorage(file, userId);

    console.log('User photo uploaded successfully:', uploadResult.publicUrl);

    return NextResponse.json({
      success: true,
      photo: uploadResult.photoRecord,
      imageUrl: uploadResult.publicUrl,
      path: uploadResult.path,
      message: 'Photo uploaded successfully'
    });

  } catch (error) {
    console.error('User photo upload error:', error);
    return NextResponse.json(
      {
        error: 'Photo upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
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