import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/user-products/{productId}/photos/link
 *
 * Links a temporary purified photo to a newly created product.
 * Used after purification completes to associate the photo with the product.
 */
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

    // 2. Get photoId from request body
    const body = await request.json();
    const { photoId } = body;

    if (!photoId || typeof photoId !== 'string') {
      return NextResponse.json({
        error: 'Photo ID is required'
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
      console.error('[link-photo] Product not found:', { productId, userId, error: productError });
      return NextResponse.json({
        error: 'Product not found'
      }, { status: 404 });
    }

    // 4. Verify photo ownership and link to product
    const { data: photo, error: photoError } = await supabase
      .from('user_product_photos')
      .update({ product_id: productId })
      .eq('id', photoId)
      .eq('user_id', userId)
      .select()
      .single();

    if (photoError) {
      console.error('[link-photo] Failed to link photo:', photoError);
      return NextResponse.json({
        error: 'Failed to link photo to product',
        details: photoError.message
      }, { status: 500 });
    }

    console.log('[link-photo] Photo linked successfully:', { photoId, productId });

    return NextResponse.json({
      success: true,
      photo
    });

  } catch (error) {
    console.error('[link-photo] POST error:', error);
    return NextResponse.json({
      error: 'Failed to link photo to product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
