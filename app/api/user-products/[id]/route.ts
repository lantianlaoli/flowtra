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
    const { product_name, description, brand_id, product_details } = body;

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

    if (product_details !== undefined) {
      updateData.product_details = product_details || null;
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

    // First, check if the product exists and belongs to the user
    const { data: product, error: fetchError } = await supabase
      .from('user_products')
      .select('id, product_name')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Count how many projects reference this product (for logging purposes)
    const [standardAdsCount, multiVariantCount, characterAdsCount] = await Promise.all([
      supabase.from('standard_ads_projects').select('id', { count: 'exact', head: true })
        .eq('selected_product_id', id),
      supabase.from('multi_variant_ads_projects').select('id', { count: 'exact', head: true })
        .eq('selected_product_id', id),
      supabase.from('character_ads_projects').select('id', { count: 'exact', head: true })
        .eq('selected_product_id', id),
    ]);

    const totalReferencedProjects =
      (standardAdsCount.count || 0) +
      (multiVariantCount.count || 0) +
      (characterAdsCount.count || 0);

    // Delete the product
    // Database foreign key constraints will automatically set selected_product_id to NULL
    // in all referencing projects (ON DELETE SET NULL)
    // Photos will also be deleted by CASCADE from user_product_photos table
    const { error: deleteError } = await supabase
      .from('user_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting product:', deleteError);
      throw deleteError;
    }

    // Log successful deletion with reference count
    console.log(`Product "${product.product_name}" (${id}) deleted successfully.`,
      totalReferencedProjects > 0
        ? `${totalReferencedProjects} project(s) had their product reference cleared.`
        : 'No projects were referencing this product.'
    );

    // TODO: Delete photos from Supabase storage
    // This would require implementing storage deletion logic

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
      affectedProjects: totalReferencedProjects
    });
  } catch (error) {
    console.error('Error deleting product:', error);

    // Check if it's a foreign key constraint error (shouldn't happen with ON DELETE SET NULL, but handle it anyway)
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; message: string; details?: string };
      if (dbError.code === '23503') {
        return NextResponse.json({
          error: 'Cannot delete product',
          message: 'This product is still referenced by active projects. Please contact support if this error persists.',
          details: dbError.details
        }, { status: 409 });
      }
    }

    return NextResponse.json({
      error: 'Failed to delete product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
