import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, uploadProductPhotoToStorage } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_product_photos')
      .select('*')
      .eq('product_id', id)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      photos: data
    });
  } catch (error) {
    console.error('Error fetching product photos:', error);
    return NextResponse.json({
      error: 'Failed to fetch photos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Verify product exists and belongs to user
    const { data: product, error: productError } = await supabase
      .from('user_products')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const isPrimary = formData.get('is_primary') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Upload to storage using product photo utility
    const uploadResult = await uploadProductPhotoToStorage(file, userId);

    if (!uploadResult) {
      throw new Error('Failed to upload to storage');
    }

    // If setting as primary, unset other primary photos for this product
    if (isPrimary) {
      await supabase
        .from('user_product_photos')
        .update({ is_primary: false })
        .eq('product_id', id)
        .eq('user_id', userId);
    }

    // Save photo record
    const { data, error: insertError } = await supabase
      .from('user_product_photos')
      .insert({
        product_id: id,
        user_id: userId,
        photo_url: uploadResult.publicUrl,
        file_name: file.name,
        is_primary: isPrimary
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      photo: data
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading product photo:', error);
    return NextResponse.json({
      error: 'Failed to upload photo',
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
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Delete photo record
    const { error } = await supabase
      .from('user_product_photos')
      .delete()
      .eq('id', photoId)
      .eq('product_id', id)
      .eq('user_id', userId)
      .select('photo_url')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
      }
      throw error;
    }

    // TODO: Delete from Supabase storage
    // This would require implementing storage deletion logic

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product photo:', error);
    return NextResponse.json({
      error: 'Failed to delete photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}