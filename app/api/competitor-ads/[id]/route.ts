import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, deleteCompetitorAdFromStorage } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get a single competitor ad
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

    const { data: competitorAd, error } = await supabase
      .from('competitor_ads')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !competitorAd) {
      return NextResponse.json(
        { error: 'Competitor ad not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, competitorAd });
  } catch (error) {
    console.error('GET /api/competitor-ads/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update competitor ad (metadata only, not file)
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
    const { competitor_name, platform, language } = body;

    // Validation
    if (!competitor_name && !platform && !language) {
      return NextResponse.json(
        { error: 'At least one field (competitor_name, platform, or language) is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build update object
    const updateData: { competitor_name?: string; platform?: string; language?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString()
    };

    if (competitor_name) {
      updateData.competitor_name = competitor_name.trim();
    }

    if (platform) {
      updateData.platform = platform.trim();
    }

    if (typeof language === 'string') {
      updateData.language = language.trim();
    } else if (language === null) {
      updateData.language = null;
    }

    // Update competitor ad
    const { data: competitorAd, error } = await supabase
      .from('competitor_ads')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !competitorAd) {
      console.error('Database update error:', error);
      return NextResponse.json(
        { error: 'Failed to update competitor ad', details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, competitorAd });
  } catch (error) {
    console.error('PUT /api/competitor-ads/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete competitor ad
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
    const supabase = getSupabaseAdmin();

    // Get competitor ad to retrieve file URL
    const { data: competitorAd, error: fetchError } = await supabase
      .from('competitor_ads')
      .select('ad_file_url')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !competitorAd) {
      return NextResponse.json(
        { error: 'Competitor ad not found' },
        { status: 404 }
      );
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('competitor_ads')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete competitor ad', details: deleteError.message },
        { status: 500 }
      );
    }

    // Delete file from storage
    try {
      await deleteCompetitorAdFromStorage(competitorAd.ad_file_url);
    } catch (storageError) {
      console.error('Storage delete error (non-fatal):', storageError);
      // Don't fail the request if storage deletion fails
    }

    return NextResponse.json({ success: true, message: 'Competitor ad deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/competitor-ads/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
