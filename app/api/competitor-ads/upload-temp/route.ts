import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/competitor-ads/upload-temp
 *
 * Temporarily uploads a competitor ad file to storage WITHOUT creating a database record.
 * Used for preview/analysis before user submits.
 *
 * Returns the public URL for use in analysis.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const brandId = formData.get('brand_id') as string;
    const adFile = formData.get('ad_file') as File | null;

    // Validation
    if (!brandId || !brandId.trim()) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    if (!adFile) {
      return NextResponse.json({ error: 'Advertisement file is required' }, { status: 400 });
    }

    // Validate file type
    const isImage = adFile.type.startsWith('image/');
    const isVideo = adFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'File must be an image or video' }, { status: 400 });
    }

    // Validate file size
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (adFile.size > maxSize) {
      return NextResponse.json(
        { error: `File size must be less than ${isVideo ? '100MB' : '10MB'}` },
        { status: 400 }
      );
    }

    console.log(`[POST /api/competitor-ads/upload-temp] Uploading temp file for analysis: ${adFile.name}`);

    // Upload to temporary location
    const fileExt = adFile.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${timestamp}_${userId.slice(0, 8)}_temp.${fileExt}`;
    const filePath = `${brandId}/temp/${fileName}`;

    const supabase = getSupabaseAdmin();
    const arrayBuffer = await adFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('competitor_videos')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: adFile.type
      });

    if (error) {
      console.error(`[POST /api/competitor-ads/upload-temp] Storage upload error:`, error);
      return NextResponse.json(
        { error: 'File upload failed', details: error.message },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('competitor_videos')
      .getPublicUrl(filePath);

    console.log(`[POST /api/competitor-ads/upload-temp] ✅ Temp file uploaded: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      path: data.path,
      publicUrl,
      fileType: isVideo ? 'video' : 'image'
    }, { status: 200 });

  } catch (error) {
    console.error('[POST /api/competitor-ads/upload-temp] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
