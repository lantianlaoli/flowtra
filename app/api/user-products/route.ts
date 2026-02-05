import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

    return NextResponse.json({ success: true, products: data });
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
    brand_id?: string | null;
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
    const { product_name, brand_id } = body;

    console.log('[POST /api/user-products] Incoming request', {
      userId,
      hasName: Boolean(product_name),
      brandId: brand_id || null
    });

    if (!product_name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let data;
    try {
      // Schema verified via Supabase MCP (2026-01-12): user_products has product_name, brand_id
      const response = await supabase
        .from('user_products')
        .insert({
          user_id: userId,
          product_name,
          brand_id: brand_id || null
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
