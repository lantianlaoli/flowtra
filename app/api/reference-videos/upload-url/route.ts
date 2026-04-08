import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { buildReferenceVideoTempUploadPath } from '@/lib/storage/paths';
import { buildStorageRef } from '@/lib/storage/ops';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reference-videos/upload-url
 *
 * Generates a presigned upload URL for direct client-to-storage upload.
 * This bypasses Vercel's body size limits.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, fileType } = body;

    if (!filename || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const storagePath = buildReferenceVideoTempUploadPath({
      userId,
      draftId: crypto.randomUUID(),
      fileName: filename
    });

    console.log(`[POST /api/reference-videos/upload-url] Generating upload URL for ${storagePath}`);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.tempUploads)
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[POST /api/reference-videos/upload-url] Error generating signed URL:', error);
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }

    const ref = buildStorageRef(supabase, STORAGE_BUCKETS.tempUploads, storagePath);

    return NextResponse.json({
      success: true,
      bucket: ref.bucket,
      signedUrl: data.signedUrl,
      path: data.path,
      publicUrl: ref.publicUrl,
      token: data.token
    });

  } catch (error) {
    console.error('[POST /api/reference-videos/upload-url] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
