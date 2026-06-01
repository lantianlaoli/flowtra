import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { sendEmail } from '@/lib/resend';
import {
  FEATURE_INTEREST_ALLOWED_VALUES,
  getFeatureInterestLabel,
  type FeatureInterestOption,
} from '@/lib/feature-interest';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

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
      const subject = 'New feature interest lead';
      const html = `
        <div>
          <h2>Feature Interest Lead</h2>
          <p><strong>Feature:</strong> ${featureLabel}</p>
          ${selectedPlatform ? `<p><strong>Preferred Platform:</strong> ${selectedPlatform}</p>` : ''}
          <p><strong>Clerk User ID:</strong> ${userId}</p>
          ${userEmail ? `<p><strong>User Email:</strong> ${userEmail}</p>` : ''}
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `;
      const text =
        `Feature Interest Lead\n` +
        `Feature: ${featureLabel}\n` +
        (selectedPlatform ? `Preferred Platform: ${selectedPlatform}\n` : '') +
        `Clerk User ID: ${userId}\n` +
        (userEmail ? `User Email: ${userEmail}\n` : '') +
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
        reward_credits: 0,
      }
    });

    return NextResponse.json({
      success: true,
      awarded: false,
      awardedCredits: 0,
      alreadyClaimed: false,
    });
  } catch (error) {
    console.error('Feature interest capture failed:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
