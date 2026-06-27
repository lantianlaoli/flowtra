import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { SITE_URL } from '@/lib/seo';

const feedbackSchema = z.object({
  projectId: z.string().min(1),
  projectType: z.enum(['avatar-ads', 'video-clone', 'motion-clone']),
  feedbackType: z.enum(['positive', 'negative'])
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate request body
    const body = await request.json();
    const validation = feedbackSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { projectId, projectType, feedbackType } = validation.data;

    // 3. Query project from appropriate table
    const supabase = getSupabaseAdmin();
    const tableName = projectType === 'avatar-ads'
      ? 'avatar_ads_projects'
      : projectType === 'video-clone'
      ? 'video_clone_projects'
      : 'motion_clone_projects';

    const { data: project, error: projectError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 4. Get user details from Clerk
    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
    const user = await client.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress || 'Unknown';
    const userName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : userEmail;

    // 5. Build email content
    const projectTypeLabel = projectType === 'avatar-ads'
      ? 'Avatar Ads'
      : projectType === 'video-clone'
      ? 'Video Clone'
      : 'Motion Clone';

    const feedbackLabel = feedbackType === 'positive' ? 'Positive 👍' : 'Negative 👎';
    const feedbackEmoji = feedbackType === 'positive' ? '👍' : '👎';

    const videoUrl = projectType === 'avatar-ads'
      ? project.merged_video_url
      : projectType === 'video-clone'
      ? (project.merged_video_url || project.video_url)
      : project.output_video_url;

    const siteBase = process.env.NEXT_PUBLIC_SITE_URL || SITE_URL;
    const projectUrl = `${siteBase}/dashboard/${projectType}`;

    const subject = `[Flowtra Feedback] ${feedbackLabel} - ${projectTypeLabel} - ${projectId.substring(0, 8)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f9fafb;color:#111827;font-family:'Inter',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;padding:40px 48px;text-align:left;">
            <tr>
              <td style="font-size:24px;font-weight:600;color:#111827;">
                ${feedbackEmoji} ${feedbackLabel} Feedback Received
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:16px;color:#4b5563;">
                <strong>Project Type:</strong> ${projectTypeLabel}<br/>
                <strong>Project ID:</strong> ${projectId}<br/>
                <strong>Timestamp:</strong> ${new Date().toISOString()}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:18px;font-weight:600;">
                User Information
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:16px;color:#4b5563;">
                <strong>Name:</strong> ${userName}<br/>
                <strong>Email:</strong> ${userEmail}<br/>
                <strong>User ID:</strong> ${userId}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;font-size:18px;font-weight:600;">
                Project Details
              </td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:16px;color:#4b5563;">
                <strong>Status:</strong> ${project.status}<br/>
                <strong>Credits Cost:</strong> ${project.credits_cost || project.generation_credits_used || 'N/A'}<br/>
                ${videoUrl ? `<strong>Video URL:</strong> <a href="${videoUrl}" style="color:#111827;text-decoration:underline;">${videoUrl}</a>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding-top:32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#111827;color:#ffffff;padding:14px 28px;border-radius:9999px;font-size:16px;font-weight:600;text-align:center;">
                      <a href="${projectUrl}" style="color:#ffffff;text-decoration:none;display:inline-block;">View Dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `PROJECT FEEDBACK RECEIVED

Feedback: ${feedbackLabel}
Project Type: ${projectTypeLabel}
Project ID: ${projectId}
Timestamp: ${new Date().toISOString()}

USER INFORMATION
Name: ${userName}
Email: ${userEmail}
User ID: ${userId}

PROJECT DETAILS
Status: ${project.status}
Credits Cost: ${project.credits_cost || project.generation_credits_used || 'N/A'}
${videoUrl ? `Video URL: ${videoUrl}` : ''}

View Dashboard: ${projectUrl}`;

    // 6. Send email
    const adminEmail = process.env.NOTIFY_EMAIL_TO || 'lantianlaoli@gmail.com';
    await sendEmail({
      to: adminEmail,
      subject,
      html,
      text
    });

    // 7. Return success
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
