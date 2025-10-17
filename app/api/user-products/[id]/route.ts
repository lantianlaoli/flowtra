import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({
      error: 'Failed to fetch product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { product_name, description, brand_id } = body;

    // Build update object dynamically to handle partial updates
    const updateData: Record<string, string | null> = {};

    if (product_name !== undefined) {
      if (!product_name) {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }
      updateData.product_name = product_name;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    if (brand_id !== undefined) {
      updateData.brand_id = brand_id || null;
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_products')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({
      error: 'Failed to update product',
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
    const supabase = getSupabaseAdmin();

    // Delete the product (photos will be deleted by CASCADE)
    const { error } = await supabase
      .from('user_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      throw error;
    }

    // TODO: Delete photos from Supabase storage
    // This would require implementing storage deletion logic

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({
      error: 'Failed to delete product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}