import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, uploadProductPhotoToStorage, deleteProductPhotoFromStorage } from '@/lib/supabase';
import sharp from 'sharp';
import { validateImageFormat } from '@/lib/image-validation';

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

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    // Validate image dimensions (> 300px for both width and height)
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      if (width <= 300 || height <= 300) {
        return NextResponse.json(
          { error: 'Image too small. Minimum size is greater than 300x300px.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    // Check if product already has a photo (single photo per product constraint)
    const { data: existingPhotos, error: photoCheckError } = await supabase
      .from('user_product_photos')
      .select('id')
      .eq('product_id', id)
      .eq('user_id', userId);

    if (photoCheckError) {
      throw photoCheckError;
    }

    if (existingPhotos && existingPhotos.length > 0) {
      return NextResponse.json(
        { error: 'This product already has a photo. Please delete the existing photo before uploading a new one.' },
        { status: 400 }
      );
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
    const { data: deletedPhoto, error } = await supabase
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

    if (deletedPhoto?.photo_url) {
      try {
        await deleteProductPhotoFromStorage(deletedPhoto.photo_url);
      } catch (storageError) {
        console.warn('Failed to delete product photo from storage:', storageError);
      }
    }

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
