import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  deleteBrandLogoFromStorage,
  deleteProductPhotoFromStorage,
  deleteCompetitorAdFromStorage,
  uploadBrandLogoToStorage
} from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { validateImageFormat } from '@/lib/image-validation';

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
    const updateData: { brand_name?: string; brand_slogan?: string | null; brand_details?: string | null; brand_logo_url?: string | null } = {};

    // Handle multipart/form-data (when uploading new logo)
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const brandName = formData.get('brand_name') as string | null;
      const brandSlogan = formData.get('brand_slogan') as string | null;
      const brandDetails = formData.get('brand_details') as string | null;
      const newLogoFile = formData.get('logo') as File | null;

      if (brandName) {
        updateData.brand_name = brandName.trim();
      }

      if (brandSlogan !== null) {
        updateData.brand_slogan = brandSlogan.trim() || null;
      }

      if (brandDetails !== null) {
        updateData.brand_details = (brandDetails || '').toString().trim() || null;
      }

      // Handle logo replacement
      if (newLogoFile) {
        const validationResult = validateImageFormat(newLogoFile);
        if (!validationResult.isValid) {
          return NextResponse.json({ error: validationResult.error }, { status: 400 });
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

      if (body.brand_details !== undefined) {
        updateData.brand_details = body.brand_details?.toString().trim() || null;
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

    const { data: brandProducts, error: productsError } = await supabase
      .from('user_products')
      .select('id, user_product_photos (id, photo_url)')
      .eq('brand_id', brandId)
      .eq('user_id', userId);

    if (productsError) {
      console.error('Failed to load brand products before deletion:', productsError);
      return NextResponse.json(
        { error: 'Failed to delete brand', details: productsError.message },
        { status: 500 }
      );
    }

    const productIds = (brandProducts || []).map(product => product.id);
    const productPhotoUrls = (brandProducts || []).flatMap(product =>
      product.user_product_photos?.map(photo => photo.photo_url).filter(Boolean) || []
    );

    if (productIds.length > 0) {
      const { error: deleteProductPhotosError } = await supabase
        .from('user_product_photos')
        .delete()
        .in('product_id', productIds)
        .eq('user_id', userId);

      if (deleteProductPhotosError) {
        console.error('Failed to delete product photos before brand removal:', deleteProductPhotosError);
        return NextResponse.json(
          { error: 'Failed to delete brand', details: deleteProductPhotosError.message },
          { status: 500 }
        );
      }

      const { error: deleteProductsError } = await supabase
        .from('user_products')
        .delete()
        .in('id', productIds)
        .eq('user_id', userId);

      if (deleteProductsError) {
        console.error('Failed to delete products when removing brand:', deleteProductsError);
        return NextResponse.json(
          { error: 'Failed to delete brand', details: deleteProductsError.message },
          { status: 500 }
        );
      }
    }

    const { data: competitorAds, error: competitorsError } = await supabase
      .from('competitor_ads')
      .select('id, ad_file_url')
      .eq('brand_id', brandId)
      .eq('user_id', userId);

    if (competitorsError) {
      console.error('Failed to load competitor ads before brand removal:', competitorsError);
      return NextResponse.json(
        { error: 'Failed to delete brand', details: competitorsError.message },
        { status: 500 }
      );
    }

    const competitorIds = (competitorAds || []).map(ad => ad.id);
    const competitorUrls = (competitorAds || []).map(ad => ad.ad_file_url).filter(Boolean);

    if (competitorIds.length > 0) {
      const { error: deleteCompetitorsError } = await supabase
        .from('competitor_ads')
        .delete()
        .in('id', competitorIds)
        .eq('user_id', userId);

      if (deleteCompetitorsError) {
        console.error('Failed to delete competitor ads:', deleteCompetitorsError);
        return NextResponse.json(
          { error: 'Failed to delete brand', details: deleteCompetitorsError.message },
          { status: 500 }
        );
      }
    }

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

    // Clean up storage (best effort)
    try {
      if (brand.brand_logo_url) {
        await deleteBrandLogoFromStorage(brand.brand_logo_url);
      }
    } catch (storageError) {
      console.warn('Failed to delete brand logo from storage:', storageError);
    }

    await Promise.allSettled(productPhotoUrls.map(async (photoUrl) => {
      try {
        await deleteProductPhotoFromStorage(photoUrl);
      } catch (storageError) {
        console.warn('Failed to delete product photo from storage:', storageError);
      }
    }));

    await Promise.allSettled(competitorUrls.map(async (adUrl) => {
      try {
        await deleteCompetitorAdFromStorage(adUrl);
      } catch (storageError) {
        console.warn('Failed to delete competitor asset from storage:', storageError);
      }
    }));

    console.log(`[DELETE /api/user-brands/${brandId}] Deleted brand "${brand.brand_name}" with`, {
      deletedProducts: productIds.length,
      deletedProductPhotos: productPhotoUrls.length,
      deletedCompetitorAds: competitorIds.length
    });

    return NextResponse.json({
      success: true,
      message: 'Brand and related assets deleted successfully',
      deletedProducts: productIds.length,
      deletedCompetitorAds: competitorIds.length
    });
  } catch (error) {
    console.error('DELETE /api/user-brands/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
