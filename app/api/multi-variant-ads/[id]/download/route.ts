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

    // Support both JSON and FormData (form submit)
    const contentTypeHeader = request.headers.get('content-type') || '';
    let contentType: string;
    let validateOnly: boolean | undefined;

    if (contentTypeHeader.includes('application/json')) {
      // JSON format (validation request)
      const body = await request.json();
      contentType = body.contentType;
      validateOnly = body.validateOnly;
    } else {
      // FormData format (form submit download)
      const formData = await request.formData();
      contentType = formData.get('contentType') as string;
      validateOnly = formData.get('validateOnly') === 'true';
    }

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!contentType || !['cover', 'video'].includes(contentType)) {
      return NextResponse.json({ error: 'Content type must be "cover" or "video"' }, { status: 400 });
    }

    console.log(`📥 Download request for multi-variant ads project ${id}, type: ${contentType}, validateOnly: ${validateOnly || false}`);

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
    // Cover downloads don't need validation, they're always free
    if (contentType === 'cover') {
      if (validateOnly) {
        return NextResponse.json({
          success: true,
          message: 'Validation successful (covers are free)',
          downloadCost: 0
        }, { status: 200 });
      }

      try {
        console.log(`📥 Streaming cover from KIE: ${instance.cover_image_url}`);
        const coverResponse = await fetch(instance.cover_image_url);

        if (!coverResponse.ok) {
          throw new Error(`Failed to fetch cover image: ${coverResponse.status} ${coverResponse.statusText}`);
        }

        const contentTypeHeader = coverResponse.headers.get('content-type') || 'image/jpeg';

        // Determine file extension
        const ext = contentTypeHeader.includes('png') ? 'png' :
                    contentTypeHeader.includes('webp') ? 'webp' : 'jpg';

        // Stream cover directly without buffering
        return new NextResponse(coverResponse.body, {
          status: 200,
          headers: {
            'Content-Type': contentTypeHeader,
            'Content-Disposition': `attachment; filename="flowtra-multi-variant-cover-${id}.${ext}"`,
            'Content-Length': coverResponse.headers.get('content-length') || '',
          },
        });
      } catch (downloadError) {
        console.error('💥 Failed to download cover image:', downloadError);
        return NextResponse.json({
          error: 'Failed to download cover image',
          details: downloadError instanceof Error ? downloadError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // ===== VERSION 3.0: MIXED BILLING - Download Phase =====
    // FREE generation models (veo3_fast, sora2): Charge at download
    // PAID generation models (veo3, sora2_pro): Download is FREE (already paid at generation)
    if (contentType === 'video') {
      const isFirstDownload = !instance.downloaded;
      const videoModel = instance.video_model as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';

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

          // ✅ VALIDATE-ONLY MODE: If validateOnly=true, return success without downloading
          if (validateOnly) {
            return NextResponse.json({
              success: true,
              message: 'Validation successful',
              downloadCost: downloadCost
            }, { status: 200 });
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
            `Multi-Variant Ads - Downloaded video (${videoModel.toUpperCase()})`,
            id
          );

          console.log(`[Download Billing] Charged ${downloadCost} credits for ${videoModel} download (user: ${instance.user_id})`);
        } else if (validateOnly) {
          // Paid-generation model + validate-only: just return success
          return NextResponse.json({
            success: true,
            message: 'Validation successful (already paid)',
            downloadCost: 0
          }, { status: 200 });
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
      } else if (validateOnly) {
        // Already downloaded + validate-only: return success
        return NextResponse.json({
          success: true,
          message: 'Validation successful (already downloaded)',
          downloadCost: 0
        }, { status: 200 });
      }

      // Stream the video file from KIE directly to the client (instant download start)
      try {
        console.log(`📥 Streaming video from KIE: ${instance.video_url}`);
        const videoResponse = await fetch(instance.video_url);

        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        // Stream video directly without buffering
        return new NextResponse(videoResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="flowtra-multi-variant-video-${id}.mp4"`,
            'Content-Length': videoResponse.headers.get('content-length') || '',
          },
        });
      } catch (downloadError) {
        console.error('💥 Failed to download video:', downloadError);
        return NextResponse.json({
          error: 'Failed to download video',
          details: downloadError instanceof Error ? downloadError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('💥 Multi-variant ads download API error:', error);
    return NextResponse.json({
      error: 'Failed to process download',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}