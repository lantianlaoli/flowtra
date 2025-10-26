import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all products for a specific brand
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: brandId } = await params;

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // First verify the brand belongs to the user
    const { data: brand, error: brandError } = await supabase
      .from('user_brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch products for this brand with photos
    const { data: products, error: productsError } = await supabase
      .from('user_products')
      .select(`
        *,
        user_product_photos (
          id,
          photo_url,
          is_primary,
          created_at
        )
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching brand products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: productsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, products: products || [] });
  } catch (error) {
    console.error('GET /api/brands/[id]/products error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
