import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import {
  uploadAvatarToStorage,
  getUserAvatars,
  deleteAvatar,
  uploadAvatarFromUrl,
  updateAvatarName,
  getSupabaseAdmin,
  normalizeAvatarPhotoSet,
  uploadAvatarPhotoToStorage,
  deleteAvatarPhotoFromStorage,
  addAvatarReferencePhoto,
  deleteAvatarReferencePhotoByIndex,
  promoteAvatarReferenceToPrimary,
  type UserAvatar
} from '@/lib/supabase';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';

type AvatarAction = 'rename' | 'replace_primary' | 'add_reference' | 'delete_reference' | 'promote_reference_to_primary';

function enrichAvatarRecord(avatar: UserAvatar): UserAvatar {
  const normalizedPhotoSet = normalizeAvatarPhotoSet(
    avatar.photo_set_json,
    avatar.photo_url,
    avatar.file_name
  );

  return {
    ...avatar,
    photo_set_json: normalizedPhotoSet,
    primary_photo_url: normalizedPhotoSet.primary.photo_url,
    reference_photos: normalizedPhotoSet.references
  };
}

function parseReferenceIndex(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

// GET: Fetch all user avatars
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const avatars = (await getUserAvatars(userId)).map(enrichAvatarRecord);

    return NextResponse.json({
      success: true,
      avatars: [...SYSTEM_AVATARS, ...avatars]
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
      const avatarRecord = enrichAvatarRecord(result.avatarRecord);
      return NextResponse.json({
        success: true,
        avatar: avatarRecord,
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
    const avatarRecord = enrichAvatarRecord(uploadResult.avatarRecord);

    const duration = Date.now() - startTime;
    console.log(`[Avatar Upload] Success for user ${userId} in ${duration}ms:`, {
      url: uploadResult.publicUrl,
      path: uploadResult.path,
      avatarId: uploadResult.avatarRecord?.id
    });

    return NextResponse.json({
      success: true,
      avatar: avatarRecord,
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

// PUT: Update avatar name/photos
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
    if (SYSTEM_AVATARS.some(avatar => avatar.id === avatarId)) {
      return NextResponse.json({ error: 'System avatars cannot be edited' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingAvatar, error: existingAvatarError } = await supabase
      .from('user_avatars')
      .select('*')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (existingAvatarError || !existingAvatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');

    let action: AvatarAction | null = null;
    let avatarName: string | undefined;
    let file: File | null = null;
    let referenceIndex: number | null = null;
    let referenceTag: string | null = null;

    if (isMultipart) {
      const formData = await request.formData();
      const actionValue = formData.get('action');
      action = typeof actionValue === 'string' ? actionValue as AvatarAction : null;
      avatarName = formData.get('avatarName') as string | undefined;
      file = formData.get('file') as File | null;
      referenceIndex = parseReferenceIndex(formData.get('referenceIndex'));
      referenceTag = formData.get('tag') as string | null;
    } else {
      const body = await request.json();
      action = typeof body.action === 'string' ? body.action as AvatarAction : null;
      avatarName = body.avatarName;
      referenceIndex = parseReferenceIndex(body.referenceIndex);
      referenceTag = typeof body.tag === 'string' ? body.tag : null;
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (!['rename', 'replace_primary', 'add_reference', 'delete_reference', 'promote_reference_to_primary'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const currentPhotoSet = normalizeAvatarPhotoSet(
      existingAvatar.photo_set_json,
      existingAvatar.photo_url,
      existingAvatar.file_name
    );

    if (action === 'rename') {
      if (!avatarName || typeof avatarName !== 'string') {
        return NextResponse.json({ error: 'Avatar name is required' }, { status: 400 });
      }

      if (avatarName.length > 255) {
        return NextResponse.json({ error: 'Avatar name too long (max 255 characters)' }, { status: 400 });
      }

      const updatedAvatar = enrichAvatarRecord(await updateAvatarName(avatarId, userId, avatarName));
      return NextResponse.json({
        success: true,
        avatar: updatedAvatar,
        message: 'Avatar name updated successfully'
      });
    }

    if (action === 'replace_primary' || action === 'add_reference') {
      if (!file) {
        return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
      }
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
      }

      if (action === 'add_reference' && currentPhotoSet.references.length >= 3) {
        return NextResponse.json({ error: 'You can add up to 3 reference photos.' }, { status: 400 });
      }

      const uploadedFile = await uploadAvatarPhotoToStorage(file, userId);
      let nextPhotoSet = {
        ...currentPhotoSet,
        updated_at: new Date().toISOString()
      };

      if (action === 'replace_primary') {
        const previousPrimary = currentPhotoSet.primary;
        nextPhotoSet = {
          ...nextPhotoSet,
          primary: {
            photo_url: uploadedFile.publicUrl,
            file_name: uploadedFile.fileName
          }
        };

        const { data: updatedAvatar, error: updateError } = await supabase
          .from('user_avatars')
          .update({
            photo_set_json: nextPhotoSet,
            photo_url: nextPhotoSet.primary.photo_url,
            file_name: nextPhotoSet.primary.file_name
          })
          .eq('id', avatarId)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (updateError || !updatedAvatar) {
          throw updateError ?? new Error('Failed to update avatar');
        }

        try {
          await deleteAvatarPhotoFromStorage(previousPrimary.photo_url);
        } catch (storageError) {
          console.warn('Failed to delete old avatar primary photo:', storageError);
        }

        return NextResponse.json({
          success: true,
          avatar: enrichAvatarRecord(updatedAvatar),
          message: 'Primary photo replaced successfully'
        });
      }

      const nextPhotoSetWithReference = addAvatarReferencePhoto(currentPhotoSet, {
        photo_url: uploadedFile.publicUrl,
        file_name: uploadedFile.fileName,
        tag: referenceTag === 'angle_45' || referenceTag === 'profile_or_detail' ? referenceTag : 'custom'
      });

      const { data: updatedAvatar, error: updateError } = await supabase
        .from('user_avatars')
        .update({
          photo_set_json: nextPhotoSetWithReference,
          photo_url: currentPhotoSet.primary.photo_url,
          file_name: currentPhotoSet.primary.file_name
        })
        .eq('id', avatarId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError || !updatedAvatar) {
        throw updateError ?? new Error('Failed to update avatar');
      }

      return NextResponse.json({
        success: true,
        avatar: enrichAvatarRecord(updatedAvatar),
        message: 'Reference photo added successfully'
      });
    }

    if (referenceIndex === null || referenceIndex < 0 || referenceIndex >= currentPhotoSet.references.length) {
      return NextResponse.json({ error: 'Invalid reference index' }, { status: 400 });
    }

    if (action === 'delete_reference') {
      const deletedReference = currentPhotoSet.references[referenceIndex];
      const nextPhotoSetWithoutReference = deleteAvatarReferencePhotoByIndex(currentPhotoSet, referenceIndex);

      const { data: updatedAvatar, error: updateError } = await supabase
        .from('user_avatars')
        .update({
          photo_set_json: nextPhotoSetWithoutReference,
          photo_url: currentPhotoSet.primary.photo_url,
          file_name: currentPhotoSet.primary.file_name
        })
        .eq('id', avatarId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError || !updatedAvatar) {
        throw updateError ?? new Error('Failed to update avatar');
      }

      try {
        await deleteAvatarPhotoFromStorage(deletedReference.photo_url);
      } catch (storageError) {
        console.warn('Failed to delete avatar reference photo:', storageError);
      }

      return NextResponse.json({
        success: true,
        avatar: enrichAvatarRecord(updatedAvatar),
        message: 'Reference photo deleted successfully'
      });
    }

    const nextPhotoSetWithPromotedReference = promoteAvatarReferenceToPrimary(currentPhotoSet, referenceIndex);

    const { data: updatedAvatar, error: updateError } = await supabase
      .from('user_avatars')
      .update({
        photo_set_json: nextPhotoSetWithPromotedReference,
        photo_url: nextPhotoSetWithPromotedReference.primary.photo_url,
        file_name: nextPhotoSetWithPromotedReference.primary.file_name
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError || !updatedAvatar) {
      throw updateError ?? new Error('Failed to update avatar');
    }

    return NextResponse.json({
      success: true,
      avatar: enrichAvatarRecord(updatedAvatar),
      message: 'Reference photo promoted to primary successfully'
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
    if (SYSTEM_AVATARS.some(avatar => avatar.id === avatarId)) {
      return NextResponse.json({ error: 'System avatars cannot be deleted' }, { status: 400 });
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
