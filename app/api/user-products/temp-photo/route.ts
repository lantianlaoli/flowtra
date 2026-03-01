import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseStorageObjectRefFromPublicUrl } from '@/lib/storage/ops';

/**
 * POST /api/user-products/temp-photo
 *
 * Creates a temporary photo record for purification tracking before product exists.
 * The photo will be linked to a product later via the photos/link endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get image URL from request body
    const body = await request.json();
    const { imageUrl, fileName, storageBucket, storagePath } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({
        error: 'Image URL is required'
      }, { status: 400 });
    }

    const parsedRef = typeof storageBucket === 'string' && typeof storagePath === 'string'
      ? { bucket: storageBucket, path: storagePath }
      : parseStorageObjectRefFromPublicUrl(imageUrl);

    // 3. Create temporary photo record (product_id NULL for now)
    const supabase = getSupabaseAdmin();
    const insertWithRole = await supabase
      .from('user_product_photos')
      .insert({
        product_id: null, // Will be linked when product is created
        user_id: userId,
        photo_url: imageUrl,
        file_name: fileName || `temp-photo-${Date.now()}.png`,
        storage_bucket: parsedRef?.bucket || null,
        storage_path: parsedRef?.path || null,
        photo_role: 'frontal',
        is_primary: true,
        purification_status: 'uploading'
      })
      .select('id')
      .single();

    let photo = insertWithRole.data;
    let photoError = insertWithRole.error;

    if (photoError?.code === '42703') {
      const fallbackInsert = await supabase
        .from('user_product_photos')
        .insert({
          product_id: null,
          user_id: userId,
          photo_url: imageUrl,
          file_name: fileName || `temp-photo-${Date.now()}.png`,
          storage_bucket: parsedRef?.bucket || null,
          storage_path: parsedRef?.path || null,
          is_primary: true,
          purification_status: 'uploading'
        })
        .select('id')
        .single();
      photo = fallbackInsert.data;
      photoError = fallbackInsert.error;
    }

    if (photoError) {
      console.error('[temp-photo] Failed to create photo record:', photoError);
      return NextResponse.json({
        error: 'Failed to create photo record',
        details: photoError.message
      }, { status: 500 });
    }

    if (!photo) {
      return NextResponse.json({
        error: 'Failed to create photo record',
        details: 'No photo data returned'
      }, { status: 500 });
    }

    console.log('[temp-photo] Temporary photo record created:', { photoId: photo.id, userId });

    return NextResponse.json({
      success: true,
      photoId: photo.id
    });

  } catch (error) {
    console.error('[temp-photo] POST error:', error);
    return NextResponse.json({
      error: 'Failed to create temporary photo record',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
