import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, deleteBrandLogoFromStorage, uploadBrandLogoToStorage } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get single brand
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const brandId = params.id;

    const supabase = getSupabaseAdmin();
    const { data: brand, error } = await supabase
      .from('user_brands')
      .select('*')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, brand });
  } catch (error) {
    console.error('GET /api/user-brands/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update brand (name, slogan, or logo)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const brandId = params.id;
    const supabase = getSupabaseAdmin();

    // Verify brand ownership
    const { data: existingBrand, error: fetchError } = await supabase
      .from('user_brands')
      .select('*')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingBrand) {
      return NextResponse.json({ error: 'Brand not found or unauthorized' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type');
    const updateData: { brand_name?: string; brand_slogan?: string | null; brand_logo_url?: string } = {};

    // Handle multipart/form-data (when uploading new logo)
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const brandName = formData.get('brand_name') as string | null;
      const brandSlogan = formData.get('brand_slogan') as string | null;
      const newLogoFile = formData.get('logo') as File | null;

      if (brandName) {
        updateData.brand_name = brandName.trim();
      }

      if (brandSlogan !== null) {
        updateData.brand_slogan = brandSlogan.trim() || null;
      }

      // Handle logo replacement
      if (newLogoFile) {
        // Validate file
        if (!newLogoFile.type.startsWith('image/')) {
          return NextResponse.json({ error: 'Logo must be an image file' }, { status: 400 });
        }

        if (newLogoFile.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: 'Logo file size must be less than 5MB' }, { status: 400 });
        }

        // Upload new logo
        try {
          const uploadResult = await uploadBrandLogoToStorage(newLogoFile, userId);
          updateData.brand_logo_url = uploadResult.publicUrl;

          // Delete old logo
          try {
            await deleteBrandLogoFromStorage(existingBrand.brand_logo_url);
          } catch (deleteError) {
            console.warn('Failed to delete old logo (continuing anyway):', deleteError);
          }
        } catch (uploadError) {
          console.error('Logo upload error:', uploadError);
          return NextResponse.json(
            { error: 'Failed to upload new logo', details: uploadError instanceof Error ? uploadError.message : 'Unknown error' },
            { status: 500 }
          );
        }
      }
    } else {
      // Handle JSON request (when updating name/slogan only)
      const body = await request.json();

      if (body.brand_name !== undefined) {
        updateData.brand_name = body.brand_name.trim();
      }

      if (body.brand_slogan !== undefined) {
        updateData.brand_slogan = body.brand_slogan?.trim() || null;
      }
    }

    // Update database
    const { data: updatedBrand, error: updateError } = await supabase
      .from('user_brands')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', brandId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update brand', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, brand: updatedBrand });
  } catch (error) {
    console.error('PUT /api/user-brands/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete brand
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const brandId = params.id;
    const supabase = getSupabaseAdmin();

    // Verify brand ownership and get logo URL
    const { data: brand, error: fetchError } = await supabase
      .from('user_brands')
      .select('*')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !brand) {
      return NextResponse.json({ error: 'Brand not found or unauthorized' }, { status: 404 });
    }

    // Delete brand from database (will cascade to set brand_id to NULL in user_products)
    const { error: deleteError } = await supabase
      .from('user_brands')
      .delete()
      .eq('id', brandId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete brand', details: deleteError.message },
        { status: 500 }
      );
    }

    // Delete logo from storage
    try {
      await deleteBrandLogoFromStorage(brand.brand_logo_url);
    } catch (storageError) {
      console.warn('Failed to delete logo from storage (brand already deleted from DB):', storageError);
      // Continue anyway since the database record is already deleted
    }

    return NextResponse.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/user-brands/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
