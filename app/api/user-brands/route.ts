import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadBrandLogoToStorage } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { validateImageFormat } from '@/lib/image-validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all brands for current user
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch brands with product count
    const { data: brands, error } = await supabase
      .from('user_brands')
      .select(`
        *,
        user_products:user_products(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching brands:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brands', details: error.message },
        { status: 500 }
      );
    }

    // Transform the response to include product count
    const brandsWithCount = brands?.map(brand => ({
      ...brand,
      product_count: brand.user_products?.[0]?.count || 0
    })) || [];

    return NextResponse.json({ success: true, brands: brandsWithCount });
  } catch (error) {
    console.error('GET /api/user-brands error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new brand with logo upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const brandName = formData.get('brand_name') as string;
    const brandSlogan = formData.get('brand_slogan') as string | null;
    const brandDetails = formData.get('brand_details') as string | null;
    const logoFile = formData.get('logo') as File | null;

    // Validation
    if (!brandName || brandName.trim().length === 0) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    let logoUrl: string | null = null;
    if (logoFile) {
      const validationResult = validateImageFormat(logoFile);
      if (!validationResult.isValid) {
        return NextResponse.json({ error: validationResult.error }, { status: 400 });
      }

      // Validate file size (max 5MB)
      if (logoFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Logo file size must be less than 5MB' }, { status: 400 });
      }

      // Upload logo to storage
      try {
        const uploadResult = await uploadBrandLogoToStorage(logoFile, userId);
        logoUrl = uploadResult.publicUrl;
      } catch (uploadError) {
        console.error('Logo upload error:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload logo', details: uploadError instanceof Error ? uploadError.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    // Create brand record in database
    const supabase = getSupabaseAdmin();
    const { data: brand, error: dbError } = await supabase
      .from('user_brands')
      .insert({
        user_id: userId,
        brand_name: brandName.trim(),
        brand_slogan: brandSlogan?.trim() || null,
        brand_details: brandDetails?.toString().trim() || null,
        brand_logo_url: logoUrl
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // TODO: Cleanup uploaded logo file on database failure
      return NextResponse.json(
        { error: 'Failed to create brand', details: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, brand }, { status: 201 });
  } catch (error) {
    console.error('POST /api/user-brands error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
