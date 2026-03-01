import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Buffer } from 'buffer';
import { buildCompetitorAdTempUploadPath } from '@/lib/storage/paths';
import { buildStorageRef } from '@/lib/storage/ops';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes for large video uploads
export const experimental_bodySizeLimit = 500 * 1024 * 1024; // 500MB limit for video uploads

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
    const adFile = formData.get('ad_file') as File | null;

    if (!adFile) {
      return NextResponse.json({ error: 'Advertisement file is required' }, { status: 400 });
    }

    // Validate file type - VIDEO ONLY
    const isVideo = adFile.type.startsWith('video/');

    if (!isVideo) {
      return NextResponse.json({ error: 'Only video files are supported' }, { status: 400 });
    }

    // No file size limit - all video sizes accepted

    console.log(`[POST /api/competitor-ads/upload-temp] Uploading temp file for analysis: ${adFile.name}`);

    const filePath = buildCompetitorAdTempUploadPath({
      userId,
      draftId: crypto.randomUUID(),
      fileName: adFile.name
    });

    const supabase = getSupabaseAdmin();
    const arrayBuffer = await adFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.tempUploads)
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

    const ref = buildStorageRef(supabase, STORAGE_BUCKETS.tempUploads, data.path);

    console.log(`[POST /api/competitor-ads/upload-temp] ✅ Temp file uploaded: ${ref.publicUrl}`);

    return NextResponse.json({
      success: true,
      bucket: ref.bucket,
      path: ref.path,
      publicUrl: ref.publicUrl,
      fileType: 'video'
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
