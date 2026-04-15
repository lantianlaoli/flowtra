import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SYSTEM_PRODUCTS, toProductLikeWithPhotos } from '@/lib/default-products';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_products')
      .select(`
        *,
        user_product_photos (
          *
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const mergedProducts = [
      ...SYSTEM_PRODUCTS.map(toProductLikeWithPhotos),
      ...(data || [])
    ];

    return NextResponse.json({ success: true, products: mergedProducts });
  } catch (error) {
    console.error('Error fetching user products:', error);
    return NextResponse.json({
      error: 'Failed to fetch products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  type CreateProductRequest = {
    product_name?: string;
  };

  let requestBody: CreateProductRequest | null = null;
  let userId: string | null = null;

  try {
    const authResult = await auth();
    userId = authResult.userId ?? null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CreateProductRequest;
    requestBody = body;
    const { product_name } = body;

    console.log('[POST /api/user-products] Incoming request', {
      userId,
      hasName: Boolean(product_name)
    });

    if (!product_name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let data;
    try {
      // Schema verified via Supabase MCP (2026-03-01) and migration 20260301_restructure_storage_and_remove_brands:
      // user_products persists top-level user-owned products.
      const response = await supabase
        .from('user_products')
        .insert({
          user_id: userId,
          product_name
        })
        .select()
        .single();
      data = response.data;
      if (response.error) {
        console.error('[POST /api/user-products] Supabase insert error', response.error);
        throw response.error;
      }
    } catch (supabaseError) {
      console.error('[POST /api/user-products] Supabase request failed', {
        userId,
        error: supabaseError instanceof Error ? supabaseError.message : supabaseError
      });
      throw supabaseError;
    }

    return NextResponse.json({
      success: true,
      product: data
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/user-products] Error creating product:', {
      userId,
      payload: requestBody,
      error
    });
    return NextResponse.json({
      error: 'Failed to create product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
