import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Buffer } from 'buffer';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadCreatorVideoCoverToStorage } from '@/lib/creator-videos-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Video id is required' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          error: `Image size must be 8MB or less. Received ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existingVideo, error: videoFetchError } = await supabase
      .from('creator_source_videos')
      .select('id, user_id, platform_video_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (videoFetchError || !existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uploadResult = await uploadCreatorVideoCoverToStorage({
      userId,
      creatorVideoId: existingVideo.id,
      fileName: file.name || `${existingVideo.platform_video_id || existingVideo.id}.png`,
      buffer: Buffer.from(arrayBuffer),
      contentType: file.type,
    });

    const { data: updatedVideo, error: updateError } = await supabase
      .from('creator_source_videos')
      .update({
        cover_url: uploadResult.publicUrl,
        cover_storage_bucket: uploadResult.bucket,
        cover_storage_path: uploadResult.path
      })
      .eq('id', existingVideo.id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError || !updatedVideo) {
      console.error('[Creator Video First Frame] Failed to update cover_url:', updateError);
      return NextResponse.json({ error: 'Failed to update first frame image' }, { status: 500 });
    }

    return NextResponse.json({ video: updatedVideo });
  } catch (error) {
    console.error('[Creator Video First Frame] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
