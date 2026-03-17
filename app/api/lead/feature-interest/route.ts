import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { sendEmail } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deductCredits } from '@/lib/credits';
import {
  FEATURE_INTEREST_ALLOWED_VALUES,
  getFeatureInterestLabel,
  type FeatureInterestOption,
} from '@/lib/feature-interest';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

const FEATURE_INTEREST_REWARD_DESCRIPTION = 'Feature interest reward (100 credits)';
const FEATURE_INTEREST_REWARD_AMOUNT = 100;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const featureRaw = typeof body?.feature === 'string' ? body.feature.trim() : '';
    const otherText = typeof body?.otherText === 'string' ? body.otherText.trim() : '';
    const selectedPlatform = typeof body?.selectedPlatform === 'string' ? body.selectedPlatform.trim() : '';

    if (!FEATURE_INTEREST_ALLOWED_VALUES.has(featureRaw as FeatureInterestOption)) {
      return NextResponse.json({ success: false, error: 'Invalid feature selection' }, { status: 400 });
    }

    if (featureRaw === 'other' && !otherText) {
      return NextResponse.json({ success: false, error: 'otherText is required when feature is other' }, { status: 400 });
    }

    const feature = featureRaw as FeatureInterestOption;

    const supabaseAdmin = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-03-01):
    // user_credits columns used: user_id, purchased_credits, subscription_credits, credits_remaining
    // credit_transactions columns used: user_id, type, amount, description, created_at
    const { data: existingReward } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('description', FEATURE_INTEREST_REWARD_DESCRIPTION)
      .limit(1)
      .maybeSingle();

    if (existingReward) {
      return NextResponse.json({
        success: true,
        awarded: false,
        awardedCredits: 0,
        alreadyClaimed: true,
      });
    }

    // Ensure user_credits row exists for this account before adjustment.
    const { error: ensureCreditsError } = await supabaseAdmin
      .from('user_credits')
      .upsert(
        {
          user_id: userId,
          purchased_credits: 0,
          subscription_credits: 0,
          has_purchased: false,
        },
        {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        }
      );

    if (ensureCreditsError) {
      console.error('Failed to ensure user_credits record:', ensureCreditsError);
      return NextResponse.json({ success: false, error: 'Failed to prepare user credits' }, { status: 500 });
    }

    // Use existing credit ledger logic: negative deduction refunds/credits purchased_credits.
    const grantResult = await deductCredits(userId, -FEATURE_INTEREST_REWARD_AMOUNT);
    if (!grantResult.success) {
      return NextResponse.json(
        { success: false, error: grantResult.error || 'Failed to award credits' },
        { status: 500 }
      );
    }

    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'purchase',
        amount: FEATURE_INTEREST_REWARD_AMOUNT,
        description: FEATURE_INTEREST_REWARD_DESCRIPTION,
      });

    if (transactionError) {
      // Best-effort rollback if transaction marker write fails.
      await deductCredits(userId, FEATURE_INTEREST_REWARD_AMOUNT);
      console.error('Failed to record feature interest reward transaction:', transactionError);
      return NextResponse.json({ success: false, error: 'Failed to record reward transaction' }, { status: 500 });
    }

    const notifyTo = process.env.NOTIFY_EMAIL_TO;
    if (process.env.RESEND_API_KEY && notifyTo) {
      let userEmail: string | null = null;
      try {
        const maybeFn = clerkClient as unknown;
        const resolved: unknown = typeof maybeFn === 'function' ? await (maybeFn as () => Promise<unknown>)() : maybeFn;
        const usersApi = (resolved as { users?: { getUser?: (id: string) => Promise<{ emailAddresses?: Array<{ emailAddress: string }> }> } })?.users;

        if (usersApi?.getUser) {
          const user = await usersApi.getUser(userId);
          userEmail = user?.emailAddresses?.[0]?.emailAddress || null;
        }
      } catch (clerkError) {
        console.warn('Failed to fetch Clerk user for feature-interest lead:', clerkError);
      }

      const featureLabel = getFeatureInterestLabel(feature, otherText);
      const subject = 'New feature interest lead (100-credit reward claimed)';
      const html = `
        <div>
          <h2>Feature Interest Reward Claimed</h2>
          <p><strong>Feature:</strong> ${featureLabel}</p>
          ${selectedPlatform ? `<p><strong>Preferred Platform:</strong> ${selectedPlatform}</p>` : ''}
          <p><strong>Clerk User ID:</strong> ${userId}</p>
          ${userEmail ? `<p><strong>User Email:</strong> ${userEmail}</p>` : ''}
          <p><strong>Reward:</strong> ${FEATURE_INTEREST_REWARD_AMOUNT} credits</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `;
      const text =
        `Feature Interest Reward Claimed\n` +
        `Feature: ${featureLabel}\n` +
        (selectedPlatform ? `Preferred Platform: ${selectedPlatform}\n` : '') +
        `Clerk User ID: ${userId}\n` +
        (userEmail ? `User Email: ${userEmail}\n` : '') +
        `Reward: ${FEATURE_INTEREST_REWARD_AMOUNT} credits\n` +
        `Timestamp: ${new Date().toISOString()}`;

      await sendEmail({ to: notifyTo, subject, html, text });
    }

    captureServerEvent(ANALYTICS_EVENTS.feature_interest_submitted, {
      distinctId: userId,
      request: req,
      properties: {
        feature: 'lead_capture',
        surface: 'feature_interest_api',
        selected_platform: selectedPlatform || undefined,
        reward_credits: FEATURE_INTEREST_REWARD_AMOUNT,
      }
    });

    return NextResponse.json({
      success: true,
      awarded: true,
      awardedCredits: FEATURE_INTEREST_REWARD_AMOUNT,
      alreadyClaimed: false,
    });
  } catch (error) {
    console.error('Feature interest capture failed:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
