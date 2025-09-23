import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCreditCost } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contentType } = await request.json();
    const { instanceId } = await context.params;

    if (!contentType || !['cover', 'video'].includes(contentType)) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: instance, error: fetchError } = await supabase
      .from('multi_variant_projects')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.status !== 'completed') {
      return NextResponse.json({ error: 'Content not ready' }, { status: 400 });
    }

    const contentUrl = contentType === 'cover' ? instance.cover_image_url : instance.video_url;
    if (!contentUrl) {
      return NextResponse.json({ error: 'Content not available' }, { status: 404 });
    }

    if (instance.downloaded) {
      return NextResponse.json({
        success: true,
        downloadUrl: contentUrl,
        message: 'Already downloaded',
        creditsCharged: 0
      });
    }

    const creditCost = getCreditCost('download');

    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (creditsError || !userCredits || userCredits.credits_remaining < creditCost) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    const { error: updateCreditsError } = await supabase
      .from('user_credits')
      .update({
        credits_remaining: userCredits.credits_remaining - creditCost,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateCreditsError) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    const { error: updateInstanceError } = await supabase
      .from('multi_variant_projects')
      .update({
        downloaded: true,
        download_credits_used: creditCost,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId);

    if (updateInstanceError) {
      console.error('Failed to mark instance as downloaded:', updateInstanceError);
    }

    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'usage',
        amount: -creditCost,
        description: `Downloaded ${contentType} from multi-variant project`,
        history_id: instanceId
      });

    return NextResponse.json({
      success: true,
      downloadUrl: contentUrl,
      creditsCharged: creditCost,
      remainingCredits: userCredits.credits_remaining - creditCost
    });

  } catch (error) {
    console.error('Multi-variant download error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}