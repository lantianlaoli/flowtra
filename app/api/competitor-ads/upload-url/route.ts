import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/competitor-ads/upload-url
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
    const { filename, fileType, brandId, competitorName } = body;

    if (!filename || !fileType || !brandId || !competitorName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const fileExt = filename.split('.').pop();
    const timestamp = Date.now();
    const cleanCompetitorName = competitorName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const storagePath = `${brandId}/${cleanCompetitorName}/${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    console.log(`[POST /api/competitor-ads/upload-url] Generating upload URL for ${storagePath}`);

    const { data, error } = await supabase.storage
      .from('competitor_videos')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[POST /api/competitor-ads/upload-url] Error generating signed URL:', error);
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }

    // Get public URL for the record
    const { data: publicUrlData } = supabase.storage
      .from('competitor_videos')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
      token: data.token
    });

  } catch (error) {
    console.error('[POST /api/competitor-ads/upload-url] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
