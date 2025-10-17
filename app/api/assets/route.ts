import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, UserProduct } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS (we're already checking Clerk auth)
    const supabase = getSupabaseAdmin();

    console.log('[Assets API] User ID:', userId);

    // Fetch all brands
    const { data: brands, error: brandsError } = await supabase
      .from('user_brands')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log('[Assets API] Brands query result:', {
      count: brands?.length,
      error: brandsError,
      brands: brands
    });

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return NextResponse.json(
        { error: 'Failed to fetch brands' },
        { status: 500 }
      );
    }

    // Fetch all products with photos
    const { data: allProducts, error: productsError } = await supabase
      .from('user_products')
      .select(`
        *,
        user_product_photos(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log('[Assets API] Products query result:', {
      count: allProducts?.length,
      error: productsError,
      products: allProducts
    });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Separate branded and unbranded products
    const brandedProducts = (allProducts || []).filter(p => p.brand_id);
    const unbrandedProducts = (allProducts || []).filter(p => !p.brand_id);

    console.log('[Assets API] Product separation:', {
      total: allProducts?.length,
      branded: brandedProducts.length,
      unbranded: unbrandedProducts.length
    });

    // Group products by brand_id
    const productsByBrand: Record<string, UserProduct[]> = {};
    brandedProducts.forEach(product => {
      if (product.brand_id) {
        if (!productsByBrand[product.brand_id]) {
          productsByBrand[product.brand_id] = [];
        }
        productsByBrand[product.brand_id].push(product);
      }
    });

    console.log('[Assets API] Products grouped by brand:', productsByBrand);

    // Attach products to their brands
    const brandsWithProducts = (brands || []).map(brand => ({
      ...brand,
      products: productsByBrand[brand.id] || []
    }));

    console.log('[Assets API] Final brands with products:', brandsWithProducts);

    const response = {
      brands: brandsWithProducts,
      unbrandedProducts: unbrandedProducts || [],
      stats: {
        totalBrands: brands?.length || 0,
        totalProducts: (allProducts?.length || 0),
        unbrandedCount: unbrandedProducts?.length || 0
      }
    };

    console.log('[Assets API] Final response:', JSON.stringify(response, null, 2));

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in /api/assets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
