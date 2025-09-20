import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';
import { THUMBNAIL_CREDIT_COST } from '@/lib/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: recordId } = await params;
    const supabase = getSupabase();

    // Get thumbnail record
    const { data: record, error: recordError } = await supabase
      .from('thumbnail_history')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single();

    if (recordError || !record) {
      return NextResponse.json({ message: 'Thumbnail not found' }, { status: 404 });
    }

    if (record.status !== 'completed' || !record.thumbnail_url) {
      return NextResponse.json({ message: 'Thumbnail not ready for download' }, { status: 400 });
    }

    if (record.downloaded) {
      return NextResponse.json({
        message: 'Already downloaded',
        downloadUrl: record.thumbnail_url
      });
    }

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    // Only deduct credits if the record has a credits_cost > 0
    const creditCost = record.credits_cost || 0;

    if (creditCost > 0) {
      if (creditsError || !userCredits || userCredits.credits_remaining < creditCost) {
        return NextResponse.json({ message: `Insufficient credits. Need ${creditCost} credits.` }, { status: 400 });
      }

      // Deduct credits
      const { error: deductError } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: userCredits.credits_remaining - creditCost,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (deductError) {
        console.error('Failed to deduct credits:', deductError);
        return NextResponse.json({ message: 'Failed to deduct credits' }, { status: 500 });
      }

      // Record credit transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: -creditCost,
          type: 'usage',
          description: `Downloaded thumbnail: ${record.title}`
        });

      if (transactionError) {
        console.error('Failed to record transaction:', transactionError);
      }
    }

    // Mark as downloaded
    const { error: updateError } = await supabase
      .from('thumbnail_history')
      .update({
        downloaded: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    if (updateError) {
      console.error('Failed to update download status:', updateError);
    }

    const finalCreditsRemaining = creditCost > 0 && userCredits
      ? userCredits.credits_remaining - creditCost
      : userCredits?.credits_remaining || 0;

    return NextResponse.json({
      success: true,
      downloadUrl: record.thumbnail_url,
      creditsRemaining: finalCreditsRemaining
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}