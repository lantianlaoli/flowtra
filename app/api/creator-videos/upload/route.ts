import { after, NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeCreatorVideoAndUpdate } from '@/lib/creator-video-analysis';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const normalizeStorageSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : '';
    const storageBucket = typeof body.storageBucket === 'string' ? body.storageBucket.trim() : '';
    const creatorVideoId = typeof body.creatorVideoId === 'string' ? body.creatorVideoId.trim() : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : '';

    if (!storagePath || !storageBucket || !creatorVideoId || !fileName || !fileType) {
      return NextResponse.json({ error: 'storagePath, storageBucket, creatorVideoId, fileName and fileType are required' }, { status: 400 });
    }

    if (!fileType.startsWith('video/')) {
      return NextResponse.json({ error: 'Only video files are supported' }, { status: 400 });
    }

    if (storageBucket !== STORAGE_BUCKETS.userVideos) {
      return NextResponse.json({ error: 'Invalid storage bucket' }, { status: 400 });
    }

    const normalizedUserId = normalizeStorageSegment(userId);
    const normalizedCreatorVideoId = normalizeStorageSegment(creatorVideoId);
    const sourcePathPatterns = [
      new RegExp(`^users/${escapeRegExp(normalizedUserId)}/creator-videos/${escapeRegExp(normalizedCreatorVideoId)}/source/original\\.[a-z0-9]+$`, 'i'),
      new RegExp(`^users/${escapeRegExp(normalizedUserId)}/creator-videos/${escapeRegExp(normalizedCreatorVideoId)}/source\\.[a-z0-9]+$`, 'i'),
      new RegExp(`^users/${escapeRegExp(normalizedUserId)}/creator-videos/${escapeRegExp(normalizedCreatorVideoId)}/original\\.[a-z0-9]+$`, 'i')
    ];

    if (!sourcePathPatterns.some(pattern => pattern.test(storagePath))) {
      console.error('[Creator Videos Upload] Storage path mismatch:', {
        creatorVideoId,
        normalizedCreatorVideoId,
        normalizedUserId,
        storagePath,
        userId
      });
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKETS.userVideos)
      .createSignedUrl(storagePath, 60);

    if (signedUrlError) {
      console.error('[Creator Videos Upload] Uploaded file lookup error:', signedUrlError);
      return NextResponse.json({ error: 'Uploaded video not found. Please upload again.' }, { status: 400 });
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKETS.userVideos)
      .getPublicUrl(storagePath);

    const uploadedPublicUrl = publicUrlData.publicUrl;

    const coverUrl: string | null = null;

    const sourceName = 'Uploaded';

    // Schema verified via Supabase MCP (2026-02-26): creator_sources
    const { data: existingSources, error: sourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_name', sourceName);

    if (sourceError) {
      console.error('[Creator Videos Upload] Source fetch error:', sourceError);
      return NextResponse.json({ error: 'Failed to load creator source' }, { status: 500 });
    }

    let source = existingSources?.[0] || null;
    if (!source) {
      const { data: createdSource, error: createError } = await supabase
        .from('creator_sources')
        .insert({
          user_id: userId,
          source_name: sourceName
        })
        .select()
        .single();

      if (createError || !createdSource) {
        console.error('[Creator Videos Upload] Source create error:', createError);
        return NextResponse.json({ error: 'Failed to create upload source' }, { status: 500 });
      }
      source = createdSource;
    }

    const platformVideoId = crypto.randomUUID();

    // Schema verified via Supabase MCP (2026-03-01) and migration 20260301_restructure_storage_and_remove_brands:
    // creator_source_videos includes analysis_status plus storage_bucket/storage_path columns.
    const { data: storedVideo, error: videoError } = await supabase
      .from('creator_source_videos')
      .insert({
        id: creatorVideoId,
        user_id: userId,
        source_id: source.id,
        platform: 'tiktok',
        platform_video_id: platformVideoId,
        video_url: uploadedPublicUrl,
        video_cdn_url: uploadedPublicUrl,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        cover_url: coverUrl,
        analysis_status: 'pending',
        analysis_error: null
      })
      .select()
      .single();

    if (videoError || !storedVideo) {
      console.error('[Creator Videos Upload] Video insert error:', videoError);
      return NextResponse.json({ error: 'Failed to save uploaded video' }, { status: 500 });
    }

    const storedVideoId = storedVideo.id;
    const sourceNameForAnalysis = source.source_name;
    const videoUrlForAnalysis = storedVideo.video_cdn_url || storedVideo.video_url;
    const durationSecondsForAnalysis = storedVideo.duration_seconds;

    // Avoid long in-request processing that can close production connections.
    after(async () => {
      try {
        await analyzeCreatorVideoAndUpdate({
          supabase: getSupabaseAdmin(),
          videoId: storedVideoId,
          videoUrl: videoUrlForAnalysis,
          sourceName: sourceNameForAnalysis,
          durationSeconds: durationSecondsForAnalysis
        });
      } catch (analysisError) {
        console.error('[Creator Videos Upload] Background analysis failed:', analysisError);
      }
    });

    return NextResponse.json({
      video: {
        ...storedVideo,
        source_name: source.source_name
      }
    });
  } catch (error) {
    console.error('[Creator Videos Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
