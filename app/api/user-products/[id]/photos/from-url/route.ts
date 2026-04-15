import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseStorageObjectRefFromPublicUrl } from '@/lib/storage/ops';
import { isSystemProductId } from '@/lib/default-products';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get image URL from request body
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({
        error: 'Image URL is required'
      }, { status: 400 });
    }

    const { id: productId } = await params;
    if (isSystemProductId(productId)) {
      return NextResponse.json({ error: 'System products cannot be edited' }, { status: 403 });
    }

    // 3. Verify product ownership
    const supabase = getSupabaseAdmin();
    const { data: product, error: productError } = await supabase
      .from('user_products')
      .select('id, user_id')
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (productError || !product) {
      console.error('[from-url] Product not found:', { productId, userId, error: productError });
      return NextResponse.json({
        error: 'Product not found'
      }, { status: 404 });
    }

    // 4. Create photo record with purified image URL
    // Extract filename from URL or generate a default one
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1] || `product-photo-${Date.now()}.png`;
    const parsedRef = parseStorageObjectRefFromPublicUrl(imageUrl);

    console.log('[from-url] Creating photo record:', { productId, userId, imageUrl, fileName });

    const insertWithRole = await supabase
      .from('user_product_photos')
      .insert({
        product_id: productId,
        photo_url: imageUrl,
        file_name: fileName,
        storage_bucket: parsedRef?.bucket || null,
        storage_path: parsedRef?.path || null,
        photo_role: 'frontal',
        is_primary: true,
        user_id: userId
      })
      .select()
      .single();

    let photo = insertWithRole.data;
    let photoError = insertWithRole.error;

    if (photoError?.code === '42703') {
      const fallbackInsert = await supabase
        .from('user_product_photos')
        .insert({
          product_id: productId,
          photo_url: imageUrl,
          file_name: fileName,
          storage_bucket: parsedRef?.bucket || null,
          storage_path: parsedRef?.path || null,
          is_primary: true,
          user_id: userId
        })
        .select()
        .single();
      photo = fallbackInsert.data;
      photoError = fallbackInsert.error;
    }

    if (photoError) {
      console.error('[from-url] Failed to create photo record:', photoError);
      return NextResponse.json({
        error: 'Failed to save photo',
        details: photoError.message
      }, { status: 500 });
    }

    console.log('[from-url] Photo record created successfully:', { photoId: photo.id });

    return NextResponse.json({
      success: true,
      photo
    });

  } catch (error) {
    console.error('[from-url] POST error:', error);
    return NextResponse.json({
      error: 'Failed to save product photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
