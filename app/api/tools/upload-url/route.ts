import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildToolTempUploadPath } from '@/lib/storage/paths';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';

const buildSafeFileName = (originalName: string, kind: 'video' | 'image') => {
  const nameParts = originalName.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop() : kind === 'video' ? 'mp4' : 'png';
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
};

/**
 * POST /api/tools/upload-url
 * Generate a signed upload URL for temporary Supabase Storage.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, fileType, kind } = body as {
      filename?: string;
      fileType?: string;
      kind?: 'video' | 'image';
    };

    if (!filename || !fileType || (kind !== 'video' && kind !== 'image')) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const safeName = buildSafeFileName(filename, kind);
    const storagePath = buildToolTempUploadPath({
      userId,
      sessionId: crypto.randomUUID(),
      kind,
      fileName: safeName
    });

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.tempUploads)
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[POST /api/tools/upload-url] Error generating signed URL:', error);
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      path: data.path,
      fileType,
      fileName: safeName
    });
  } catch (error) {
    console.error('[POST /api/tools/upload-url] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
