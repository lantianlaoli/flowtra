import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { getAnalysisShotCount, toPersistedAnalysisV2 } from '@/lib/video-analysis-schema';
import { parseReferenceVideoTimeline } from '@/lib/reference-video-shots';
import { removeStorageObjectWithFallback } from '@/lib/storage/ops';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get a single reference video
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: referenceVideo, error } = await supabase
      .from('reference_videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !referenceVideo) {
      return NextResponse.json(
        { error: 'Reference video not found' },
        { status: 404 }
      );
    }

    // NEW: Extract shot_count from analysis_result
    const shotCount = getAnalysisShotCount((referenceVideo.analysis_result as Record<string, unknown> | null) || null);

    return NextResponse.json({
      success: true,
      referenceVideo: {
        ...referenceVideo,
        shot_count: shotCount
      }
    });
  } catch (error) {
    console.error('GET /api/reference-videos/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update reference video (metadata only, not file)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reference_name, language, analysis_result, video_duration_seconds } = body;

    const hasUpdatableField = ['reference_name', 'language', 'analysis_result', 'video_duration_seconds'].some(
      (key) => Object.prototype.hasOwnProperty.call(body, key)
    );

    if (!hasUpdatableField) {
      return NextResponse.json(
        { error: 'At least one field (reference_name, language, analysis_result, or video_duration_seconds) is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build update object
    const updateData: {
      reference_name?: string;
      language?: string | null;
      analysis_result?: Record<string, unknown> | null;
      video_duration_seconds?: number | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString()
    };

    if (reference_name) {
      updateData.reference_name = reference_name.trim();
    }

    if (typeof language === 'string') {
      updateData.language = language.trim();
    } else if (language === null) {
      updateData.language = null;
    }

    if (analysis_result && typeof analysis_result === 'object') {
      const normalizedAnalysis = toPersistedAnalysisV2(analysis_result as Record<string, unknown>);
      if (!normalizedAnalysis) {
        return NextResponse.json(
          { error: 'Invalid analysis_result payload' },
          { status: 400 }
        );
      }
      updateData.analysis_result = normalizedAnalysis as unknown as Record<string, unknown>;
      const timeline = parseReferenceVideoTimeline(
        normalizedAnalysis as unknown as Record<string, unknown>,
        typeof video_duration_seconds === 'number' ? video_duration_seconds : undefined
      );
      updateData.video_duration_seconds = timeline.videoDurationSeconds;
    } else if (analysis_result === null) {
      updateData.analysis_result = null;
      if (typeof video_duration_seconds === 'number') {
        updateData.video_duration_seconds = Math.max(1, Math.round(video_duration_seconds));
      } else if (video_duration_seconds === null) {
        updateData.video_duration_seconds = null;
      }
    } else if (typeof video_duration_seconds === 'number') {
      updateData.video_duration_seconds = Math.max(1, Math.round(video_duration_seconds));
    } else if (video_duration_seconds === null) {
      updateData.video_duration_seconds = null;
    }

    // Update reference video
    const { data: referenceVideo, error } = await supabase
      .from('reference_videos')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !referenceVideo) {
      console.error('Database update error:', error);
      return NextResponse.json(
        { error: 'Failed to update reference video', details: error?.message },
        { status: 500 }
      );
    }

    // NEW: Extract shot_count from analysis_result
    const shotCount = getAnalysisShotCount((referenceVideo.analysis_result as Record<string, unknown> | null) || null);

    return NextResponse.json({
      success: true,
      referenceVideo: {
        ...referenceVideo,
        shot_count: shotCount
      }
    });
  } catch (error) {
    console.error('PUT /api/reference-videos/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete reference video
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log(`[DELETE /api/reference-videos/[id]] Starting delete for id: ${id}, userId: ${userId}`);

    const supabase = getSupabaseAdmin();

    // First verify the record exists and belongs to the user
    console.log(`[DELETE /api/reference-videos/[id]] Verifying record ownership...`);
    const { data: existingReferenceVideo, error: fetchError } = await supabase
      .from('reference_videos')
      .select('id, user_id, source_storage_bucket, source_storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingReferenceVideo) {
      console.error(`[DELETE /api/reference-videos/[id]] Record not found or unauthorized:`, fetchError);
      return NextResponse.json(
        { error: 'Reference video not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log(`[DELETE /api/reference-videos/[id]] Record verified, proceeding with deletion...`);

    // Delete from database and clean stored source media when present.
    const { error: deleteError } = await supabase
      .from('reference_videos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error(`[DELETE /api/reference-videos/[id]] Database delete error:`, {
        message: deleteError.message,
        code: deleteError.code,
        details: deleteError.details,
        hint: deleteError.hint
      });
      return NextResponse.json(
        { error: 'Failed to delete reference video', details: deleteError.message },
        { status: 500 }
      );
    }

    try {
      await removeStorageObjectWithFallback(supabase, {
        bucket: existingReferenceVideo.source_storage_bucket,
        path: existingReferenceVideo.source_storage_path,
        publicUrl: null
      });
    } catch (storageError) {
      console.warn('[DELETE /api/reference-videos/[id]] Failed to remove stored source file:', storageError);
    }

    console.log(`[DELETE /api/reference-videos/[id]] Successfully deleted reference video: ${id}`);
    return NextResponse.json({ success: true, message: 'Reference video deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/reference-videos/[id]] Unexpected error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
