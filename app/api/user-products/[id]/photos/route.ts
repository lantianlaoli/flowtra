import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, uploadProductPhotoToStorage, deleteProductPhotoFromStorage } from '@/lib/supabase';
import sharp from 'sharp';
import { validateImageFormat } from '@/lib/image-validation';

type PhotoRole = 'frontal' | 'reference';

type ExistingPhotoRole = {
  id: string;
  photo_role: string | null;
};

export function validateProductPhotoRoleConstraints(
  existingPhotos: ExistingPhotoRole[],
  photoRole: PhotoRole
) {
  const totalPhotos = existingPhotos.length;
  const frontalCount = existingPhotos.filter(photo => photo.photo_role === 'frontal').length;
  const referenceCount = existingPhotos.filter(photo => photo.photo_role === 'reference').length;

  if (totalPhotos >= 4) {
    return 'A product can only have up to 4 photos total (1 frontal + 3 reference).';
  }

  if (photoRole === 'frontal' && frontalCount >= 1) {
    return 'This product already has a frontal image. Delete it before uploading a new frontal image.';
  }

  if (photoRole === 'reference' && referenceCount >= 3) {
    return 'A product can only have up to 3 reference images.';
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_product_photos')
      .select('*')
      .eq('product_id', id)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      photos: data
    });
  } catch (error) {
    console.error('Error fetching product photos:', error);
    return NextResponse.json({
      error: 'Failed to fetch photos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Verify product exists and belongs to user
    const { data: product, error: productError } = await supabase
      .from('user_products')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const photoRoleRaw = formData.get('photo_role');
    const photoRole = photoRoleRaw === 'frontal' || photoRoleRaw === 'reference'
      ? photoRoleRaw
      : null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!photoRole) {
      return NextResponse.json({
        error: 'photo_role is required and must be frontal or reference'
      }, { status: 400 });
    }

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    // Validate image dimensions (> 300px for both width and height)
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      if (width <= 300 || height <= 300) {
        return NextResponse.json(
          { error: 'Image too small. Minimum size is greater than 300x300px.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    // Schema verified via Supabase MCP (2026-02-05): user_product_photos has photo_role, is_primary
    let existingPhotos: Array<{ id: string; photo_role: string | null }> = [];
    const {
      data: existingPhotosWithRole,
      error: photoCheckError
    } = await supabase
      .from('user_product_photos')
      .select('id, photo_role, is_primary')
      .eq('product_id', id)
      .eq('user_id', userId);

    if (photoCheckError) {
      if (photoCheckError.code !== '42703') {
        throw photoCheckError;
      }
      const { data: fallbackPhotos, error: fallbackError } = await supabase
        .from('user_product_photos')
        .select('id, is_primary')
        .eq('product_id', id)
        .eq('user_id', userId);

      if (fallbackError) {
        throw fallbackError;
      }

      existingPhotos = (fallbackPhotos || []).map(photo => ({
        id: photo.id,
        photo_role: photo.is_primary ? 'frontal' : 'reference'
      }));
    } else {
      existingPhotos = (existingPhotosWithRole || []).map(photo => ({
        id: photo.id,
        photo_role: photo.photo_role ?? (photo.is_primary ? 'frontal' : 'reference')
      }));
    }

    const constraintError = validateProductPhotoRoleConstraints(existingPhotos, photoRole);
    if (constraintError) {
      return NextResponse.json(
        { error: constraintError },
        { status: 400 }
      );
    }

    // Upload to storage using product photo utility
    const uploadResult = await uploadProductPhotoToStorage(file, userId);

    if (!uploadResult) {
      throw new Error('Failed to upload to storage');
    }

    const isPrimary = photoRole === 'frontal';

    if (isPrimary) {
      await supabase
        .from('user_product_photos')
        .update({ is_primary: false })
        .eq('product_id', id)
        .eq('user_id', userId);
    }

    // Save photo record
    let data;
    let insertError;
    const insertPayload = {
      product_id: id,
      user_id: userId,
      photo_url: uploadResult.publicUrl,
      file_name: file.name,
      photo_role: photoRole,
      is_primary: isPrimary
    };

    const insertWithRole = await supabase
      .from('user_product_photos')
      .insert(insertPayload)
      .select()
      .single();

    data = insertWithRole.data;
    insertError = insertWithRole.error;

    if (insertError?.code === '42703') {
      const insertWithoutRole = await supabase
        .from('user_product_photos')
        .insert({
          product_id: id,
          user_id: userId,
          photo_url: uploadResult.publicUrl,
          file_name: file.name,
          is_primary: isPrimary
        })
        .select()
        .single();
      data = insertWithoutRole.data;
      insertError = insertWithoutRole.error;
    }

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      photo: data
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading product photo:', error);
    return NextResponse.json({
      error: 'Failed to upload photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Delete photo record
    const { data: deletedPhoto, error } = await supabase
      .from('user_product_photos')
      .delete()
      .eq('id', photoId)
      .eq('product_id', id)
      .eq('user_id', userId)
      .select('photo_url')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
      }
      throw error;
    }

    if (deletedPhoto?.photo_url) {
      try {
        await deleteProductPhotoFromStorage(deletedPhoto.photo_url);
      } catch (storageError) {
        console.warn('Failed to delete product photo from storage:', storageError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product photo:', error);
    return NextResponse.json({
      error: 'Failed to delete photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
