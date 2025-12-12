import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

    console.log('[from-url] Creating photo record:', { productId, userId, imageUrl, fileName });

    const { data: photo, error: photoError } = await supabase
      .from('user_product_photos')
      .insert({
        product_id: productId,
        photo_url: imageUrl,
        file_name: fileName,
        is_primary: true,
        user_id: userId
      })
      .select()
      .single();

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
