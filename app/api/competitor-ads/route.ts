import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, uploadCompetitorAdToStorage } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all competitor ads for a specific brand
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch competitor ads for the specified brand
    const { data: competitorAds, error } = await supabase
      .from('competitor_ads')
      .select('*')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitor ads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch competitor ads', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, competitorAds: competitorAds || [] });
  } catch (error) {
    console.error('GET /api/competitor-ads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new competitor ad with file upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const brandId = formData.get('brand_id') as string;
    const competitorName = formData.get('competitor_name') as string;
    const platform = formData.get('platform') as string;
    const adFile = formData.get('ad_file') as File | null;

    // Validation
    if (!brandId || brandId.trim().length === 0) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    if (!competitorName || competitorName.trim().length === 0) {
      return NextResponse.json({ error: 'Competitor name is required' }, { status: 400 });
    }

    if (!platform || platform.trim().length === 0) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    if (!adFile) {
      return NextResponse.json({ error: 'Advertisement file is required' }, { status: 400 });
    }

    // Verify brand ownership
    const supabase = getSupabaseAdmin();
    const { data: brand, error: brandError } = await supabase
      .from('user_brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 });
    }

    // Upload file to storage
    let uploadResult;
    try {
      uploadResult = await uploadCompetitorAdToStorage(adFile, brandId, competitorName);
    } catch (uploadError) {
      console.error('File upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError instanceof Error ? uploadError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Create competitor ad record in database
    const { data: competitorAd, error: dbError } = await supabase
      .from('competitor_ads')
      .insert({
        user_id: userId,
        brand_id: brandId,
        competitor_name: competitorName.trim(),
        platform: platform.trim(),
        ad_file_url: uploadResult.publicUrl,
        file_type: uploadResult.fileType as 'image' | 'video'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // TODO: Cleanup uploaded file on database failure
      return NextResponse.json(
        { error: 'Failed to create competitor ad', details: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, competitorAd }, { status: 201 });
  } catch (error) {
    console.error('POST /api/competitor-ads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
