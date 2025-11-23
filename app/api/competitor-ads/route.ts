import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, uploadCompetitorAdToStorage } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
import { analyzeCompetitorAdWithLanguage } from '@/lib/standard-ads-workflow';
import { parseCompetitorTimeline } from '@/lib/competitor-shots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all competitor ads for a specific brand
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch competitor ads for the specified brand
    const { data: competitorAds, error } = await supabase
      .from('competitor_ads')
      .select('*')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitor ads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch competitor ads', details: error.message },
        { status: 500 }
      );
    }

    // NEW: Enrich response with shot_count from analysis_result
    const enrichedAds = (competitorAds || []).map(ad => {
      let shotCount = 0;
      if (ad.analysis_result && typeof ad.analysis_result === 'object') {
        const analysis = ad.analysis_result as Record<string, unknown>;
        if (Array.isArray(analysis.shots)) {
          shotCount = analysis.shots.length;
        }
      }
      return {
        ...ad,
        shot_count: shotCount
      };
    });

    return NextResponse.json({ success: true, competitorAds: enrichedAds });
  } catch (error) {
    console.error('GET /api/competitor-ads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new competitor ad with file upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const brandId = formData.get('brand_id') as string;
    const competitorName = formData.get('competitor_name') as string;
    const platform = formData.get('platform') as string;
    const adFile = formData.get('ad_file') as File | null;

    // Validation
    if (!brandId || brandId.trim().length === 0) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    if (!competitorName || competitorName.trim().length === 0) {
      return NextResponse.json({ error: 'Competitor name is required' }, { status: 400 });
    }

    if (!platform || platform.trim().length === 0) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    if (!adFile) {
      return NextResponse.json({ error: 'Advertisement file is required' }, { status: 400 });
    }

    // Verify brand ownership
    const supabase = getSupabaseAdmin();
    const { data: brand, error: brandError } = await supabase
      .from('user_brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 });
    }

    // Upload file to storage
    let uploadResult;
    try {
      uploadResult = await uploadCompetitorAdToStorage(adFile, brandId, competitorName);
    } catch (uploadError) {
      console.error('File upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError instanceof Error ? uploadError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Create competitor ad record in database with pending analysis status
    const { data: competitorAd, error: dbError } = await supabase
      .from('competitor_ads')
      .insert({
        user_id: userId,
        brand_id: brandId,
        competitor_name: competitorName.trim(),
        platform: platform.trim(),
        ad_file_url: uploadResult.publicUrl,
        file_type: uploadResult.fileType as 'image' | 'video',
        analysis_status: 'analyzing' // Start analyzing immediately
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // TODO: Cleanup uploaded file on database failure
      return NextResponse.json(
        { error: 'Failed to create competitor ad', details: dbError.message },
        { status: 500 }
      );
    }

    console.log(`[POST /api/competitor-ads] Created competitor ad ${competitorAd.id}, starting analysis...`);

    // Perform synchronous AI analysis with language detection
    try {
      const { analysis, language } = await analyzeCompetitorAdWithLanguage({
        file_url: uploadResult.publicUrl,
        file_type: uploadResult.fileType as 'video' | 'image',
        competitor_name: competitorName.trim()
      });
      const timeline = parseCompetitorTimeline(analysis);

      console.log(`[POST /api/competitor-ads] Analysis complete for ${competitorAd.id}, language: ${language}`);

      // Update record with analysis results
      const { data: updatedAd, error: updateError } = await supabase
        .from('competitor_ads')
        .update({
          analysis_result: analysis,
          language: language,
          analysis_status: 'completed',
          analyzed_at: new Date().toISOString(),
          video_duration_seconds: timeline.videoDurationSeconds
        })
        .eq('id', competitorAd.id)
        .select()
        .single();

      if (updateError) {
        console.error(`[POST /api/competitor-ads] Failed to update analysis for ${competitorAd.id}:`, updateError);
        // Analysis succeeded but update failed - mark as failed to allow retry
        await supabase
          .from('competitor_ads')
          .update({
            analysis_status: 'failed',
            analysis_error: `Update failed: ${updateError.message}`
          })
          .eq('id', competitorAd.id);

        return NextResponse.json({ success: true, competitorAd }, { status: 201 });
      }

      console.log(`[POST /api/competitor-ads] ✅ Competitor ad ${competitorAd.id} created with complete analysis`);
      return NextResponse.json({ success: true, competitorAd: updatedAd }, { status: 201 });

    } catch (analysisError) {
      console.error(`[POST /api/competitor-ads] ❌ Analysis failed for ${competitorAd.id}:`, analysisError);

      // PRESERVE FAILED RECORDS: Mark as failed but keep record and file
      // User can retry analysis later via /api/competitor-ads/[id]/reanalyze
      const errorMessage = analysisError instanceof Error ? analysisError.message : 'Unknown analysis error';

      const { data: failedAd, error: markFailedError } = await supabase
        .from('competitor_ads')
        .update({
          analysis_status: 'failed',
          analysis_error: errorMessage
        })
        .eq('id', competitorAd.id)
        .select()
        .single();

      if (markFailedError) {
        console.error(`[POST /api/competitor-ads] Failed to mark record as failed:`, markFailedError);
        // Even if update fails, return the original record
        return NextResponse.json({
          success: true,
          competitorAd: {
            ...competitorAd,
            analysis_status: 'failed',
            analysis_error: errorMessage
          },
          warning: 'Analysis failed but record was preserved. You can retry later.'
        }, { status: 201 });
      }

      console.log(`[POST /api/competitor-ads] ⚠️ Competitor ad ${competitorAd.id} saved with failed analysis status`);
      return NextResponse.json({
        success: true,
        competitorAd: failedAd,
        warning: 'Analysis failed but record was preserved. You can retry later.'
      }, { status: 201 });
    }
  } catch (error) {
    console.error('POST /api/competitor-ads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
