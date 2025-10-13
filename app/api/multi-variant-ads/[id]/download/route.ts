import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';
import { getDownloadCost, isFreeGenerationModel } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { contentType } = await request.json(); // 'cover' or 'video'

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!contentType || !['cover', 'video'].includes(contentType)) {
      return NextResponse.json({ error: 'Content type must be "cover" or "video"' }, { status: 400 });
    }

    console.log(`📥 Download request for multi-variant ads project ${id}, type: ${contentType}`);

    const supabase = getSupabase();

    // Get workflow instance
    const { data: instance, error } = await supabase
      .from('multi_variant_ads_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !instance) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if content is ready
    if (contentType === 'cover' && !instance.cover_image_url) {
      return NextResponse.json({ error: 'Cover image is not ready yet' }, { status: 400 });
    }

    if (contentType === 'video' && !instance.video_url) {
      return NextResponse.json({ error: 'Video is not ready yet' }, { status: 400 });
    }

    // For cover downloads, no credit deduction needed (covers are free)
    if (contentType === 'cover') {
      return NextResponse.json({
        success: true,
        downloadUrl: instance.cover_image_url,
        contentType: 'cover',
        creditsUsed: 0,
        message: 'Cover download ready'
      });
    }

    // ===== VERSION 3.0: MIXED BILLING - Download Phase =====
    // FREE generation models (veo3_fast, sora2): Charge at download
    // PAID generation models (veo3, sora2_pro): Download is FREE (already paid at generation)
    if (contentType === 'video') {
      const isFirstDownload = !instance.downloaded;
      const videoModel = instance.video_model as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
      let creditsUsed = 0;

      if (isFirstDownload) {
        // Check if this model has download cost (free-generation models)
        if (isFreeGenerationModel(videoModel)) {
          const downloadCost = getDownloadCost(videoModel);

          // Check if user has enough credits
          const creditCheck = await checkCredits(instance.user_id, downloadCost);
          if (!creditCheck.hasEnoughCredits) {
            return NextResponse.json({
              error: `Insufficient credits. Need ${downloadCost} credits, have ${creditCheck.currentCredits}`,
              success: false
            }, { status: 402 });
          }

          // Deduct download cost
          const deductResult = await deductCredits(instance.user_id, downloadCost);
          if (!deductResult.success) {
            return NextResponse.json({
              error: 'Failed to deduct credits for download',
              success: false
            }, { status: 500 });
          }

          // Record credit transaction
          await recordCreditTransaction(
            instance.user_id,
            'usage',
            -downloadCost,
            `Downloaded ${videoModel} multi-variant video (${id})`,
            id
          );

          creditsUsed = downloadCost;
          console.log(`[Download Billing] Charged ${downloadCost} credits for ${videoModel} download (user: ${instance.user_id})`);
        }
        // If paid-generation model, download is FREE (no credit deduction)

        // Mark as downloaded
        await supabase
          .from('multi_variant_ads_projects')
          .update({
            downloaded: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }

      return NextResponse.json({
        success: true,
        downloadUrl: instance.video_url,
        contentType: 'video',
        creditsUsed,
        message: creditsUsed > 0
          ? `Download complete (${creditsUsed} credits charged)`
          : 'Download complete (free download)'
      });
    }

  } catch (error) {
    console.error('💥 Multi-variant ads download API error:', error);
    return NextResponse.json({
      error: 'Failed to process download',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}