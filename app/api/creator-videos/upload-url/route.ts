import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildCreatorVideoPath, getFileExtension } from '@/lib/storage/paths';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : '';

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }

    if (!fileType.startsWith('video/')) {
      return NextResponse.json({ error: 'Only video files are supported' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const creatorVideoId = crypto.randomUUID();
    const storagePath = buildCreatorVideoPath({
      userId,
      creatorVideoId,
      extension: getFileExtension(fileName, 'mp4'),
      variant: 'source'
    });

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.userVideos)
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[Creator Videos Upload URL] Signed upload URL error:', error);
      return NextResponse.json({ error: 'Failed to generate signed upload URL' }, { status: 500 });
    }

    return NextResponse.json({
      bucket: STORAGE_BUCKETS.userVideos,
      creatorVideoId,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path
    });
  } catch (error) {
    console.error('[Creator Videos Upload URL] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
