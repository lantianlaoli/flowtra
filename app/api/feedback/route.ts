import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/resend';

const feedbackSchema = z.object({
  message: z.string().min(1).max(2000),
  source: z.string().min(1).max(100),
});

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const validation = feedbackSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { message, source } = validation.data;

    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
    const user = await client.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress || 'Unknown';
    const userName = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : userEmail;

    const safeMessage = escapeHtml(message);
    const safeSource = escapeHtml(source);
    const safeName = escapeHtml(userName);
    const safeEmail = escapeHtml(userEmail);
    const safeUserId = escapeHtml(userId);
    const timestamp = new Date().toISOString();
    const localeHeader = request.headers.get('accept-language') || '';
    const locale = localeHeader.split(',')[0]?.trim() || 'unknown';

    const subject = `[Flowtra Feedback] ${safeSource} - ${timestamp.slice(0, 10)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f9fafb;color:#111827;font-family:'Inter',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;padding:40px 48px;text-align:left;">
            <tr>
              <td style="font-size:24px;font-weight:600;color:#111827;">
                New Feedback Received
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:16px;color:#4b5563;">
                <strong>Source:</strong> ${safeSource}<br/>
                <strong>Timestamp:</strong> ${timestamp}<br/>
                <strong>Locale:</strong> ${escapeHtml(locale)}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:18px;font-weight:600;">
                User Information
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:16px;color:#4b5563;">
                <strong>Name:</strong> ${safeName}<br/>
                <strong>Email:</strong> ${safeEmail}<br/>
                <strong>User ID:</strong> ${safeUserId}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:18px;font-weight:600;">
                Message
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:16px;color:#111827;background-color:#f9fafb;border-radius:8px;padding:16px 20px;line-height:1.6;white-space:pre-wrap;">
${safeMessage}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `NEW FEEDBACK RECEIVED

Source: ${source}
Timestamp: ${timestamp}
Locale: ${locale}

USER INFORMATION
Name: ${userName}
Email: ${userEmail}
User ID: ${userId}

MESSAGE
${message}`;

    const adminEmail = process.env.NOTIFY_EMAIL_TO || 'lantianlaoli@gmail.com';
    await sendEmail({
      to: adminEmail,
      subject,
      html,
      text,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
