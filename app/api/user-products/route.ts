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
          id,
          photo_url,
          file_name,
          is_primary
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
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_name, description, brand_id } = body;

    if (!product_name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_products')
      .insert({
        user_id: userId,
        product_name,
        description: description || null,
        brand_id: brand_id || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      product: data
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({
      error: 'Failed to create product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}