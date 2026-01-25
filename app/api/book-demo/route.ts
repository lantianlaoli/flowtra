import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to book a demo.' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { selectedFeatures, resourceLinks } = body;

    // 3. Validate features selection
    if (!selectedFeatures || selectedFeatures.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one feature' },
        { status: 400 }
      );
    }

    // 4. Get user info from Clerk (for email personalization)
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    }).then((res) => res.json());

    const userEmail =
      clerkUser.email_addresses?.[0]?.email_address || 'Unknown';
    const userName = clerkUser.first_name || userEmail;

    // 5. Build email content
    const avatarChecked = selectedFeatures.includes('avatar-ads') ? '☑' : '☐';
    const cloneChecked = selectedFeatures.includes('competitor-cloning')
      ? '☑'
      : '☐';
    const motionSwapChecked = selectedFeatures.includes('motion-swap') ? '☑' : '☐';

    const emailSubject = `🎯 New Demo Request from ${userName}`;
    const emailHtml = `
      <h2>New Demo Request</h2>
      <p><strong>User:</strong> ${userName} (${userEmail})</p>
      <p><strong>User ID:</strong> ${userId}</p>

      <h3>Features of Interest:</h3>
      <ul>
        <li>${avatarChecked} Avatar Ads - talking character videos</li>
        <li>${cloneChecked} Competitor Cloning - recreate successful ads with product</li>
        <li>${motionSwapChecked} Motion Swap - apply motion from a reference video to your product</li>
      </ul>

      <h3>Materials/Resources:</h3>
      <p>${resourceLinks?.trim() || '<em>No materials provided</em>'}</p>

      <hr>
      <p style="color: #666; font-size: 12px;">
        Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC
      </p>
    `;

    const emailText = `
New Demo Request

User: ${userName} (${userEmail})
User ID: ${userId}

Features of Interest:
${avatarChecked} Avatar Ads - talking character videos
${cloneChecked} Competitor Cloning - recreate successful ads with product
${motionSwapChecked} Motion Swap - apply motion from a reference video to your product

Materials/Resources:
${resourceLinks?.trim() || 'No materials provided'}

Submitted: ${new Date().toISOString()}
    `;

    // 6. Send email via Resend
    const adminEmail =
      process.env.NOTIFY_EMAIL_TO ||
      process.env.NEXT_PUBLIC_EMAIL ||
      'lantianlaoli@gmail.com';

    await sendEmail({
      to: adminEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    });

    // 7. Return success response
    return NextResponse.json({
      success: true,
      message: 'Demo request sent successfully',
    });
  } catch (error) {
    console.error('Book demo error:', error);
    return NextResponse.json(
      { error: 'Failed to send demo request. Please try again.' },
      { status: 500 }
    );
  }
}
