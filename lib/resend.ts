// Server-side Resend client and helpers
// Note: Do not import this from client components.
import { Resend } from 'resend'

type SendEmailParams = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }
  return new Resend(apiKey)
}

export async function sendEmail(params: SendEmailParams) {
  const resend = getResendClient()
  const from = params.from || process.env.RESEND_FROM || 'onboarding@resend.dev'
  const to = Array.isArray(params.to) ? params.to : [params.to]

  return await resend.emails.send({
    from,
    to,
    subject: params.subject,
    html: params.html,
    text: params.text ?? '',
  })
}

export async function sendWelcomeEmail(options: {
  to: string | string[]
  name?: string | null
}) {
  const subject = 'Welcome to Flowtra — Let\'s Create Your First AI Ad'
  const siteBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowtra.store').replace(/\/$/, '')
  const appUrl = `${siteBase}/dashboard`
  const logoUrl = `${siteBase}/logo.svg`
  const avatarAdsUrl = `${siteBase}/features/avatar-ads`
  const videoCloneUrl = `${siteBase}/features/video-clone`
  const recipientName = options.name?.trim()

  const greetingLine = recipientName ? `Hi ${recipientName},` : 'Hi there,'

  // Social media links from environment variables
  const socialLinks = [
    { label: 'Email', href: process.env.NEXT_PUBLIC_EMAIL ? `mailto:${process.env.NEXT_PUBLIC_EMAIL}` : null },
    { label: 'X', href: process.env.NEXT_PUBLIC_X },
    { label: 'LinkedIn', href: process.env.NEXT_PUBLIC_LINKEDIN?.startsWith('http') ? process.env.NEXT_PUBLIC_LINKEDIN : process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : null },
    { label: 'TikTok', href: process.env.NEXT_PUBLIC_TIKTOK },
    { label: 'Threads', href: process.env.NEXT_PUBLIC_THREADS },
    { label: 'Instagram', href: process.env.NEXT_PUBLIC_INSTAGRAM },
    { label: 'YouTube', href: process.env.NEXT_PUBLIC_YOUTUBE },
    { label: 'Discord', href: process.env.NEXT_PUBLIC_DISCORD }
  ].filter(link => link.href)

  const html = `<!DOCTYPE html>
  <html lang="en">
    <body style="margin:0;padding:0;background-color:#f9fafb;color:#111827;font-family:'Inter',Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;padding:40px 48px;text-align:left;">
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                    <tr>
                      <td style="padding-right:12px;" width="40">
                        <img src="${logoUrl}" alt="Flowtra logo" width="32" height="32" style="display:block;" />
                      </td>
                      <td style="font-size:16px;letter-spacing:0.08em;font-weight:600;text-transform:uppercase;color:#111827;">Flowtra AI</td>
                      <td></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;font-size:28px;line-height:1.2;font-weight:600;">
                  Welcome to Flowtra — Your AI Ad Studio
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;font-size:16px;line-height:1.6;color:#4b5563;">
                  ${greetingLine}<br />
                  I'm Lantian Laoli, founder of Flowtra. You now have access to two powerful AI tools designed to help you create scroll-stopping video ads without agencies, studios, or creative teams.
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;font-size:20px;font-weight:600;">
                  🎭 Avatar Ads
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Create talking head videos where an AI character showcases your product or discusses any topic. Perfect for product demonstrations, educational content, and brand storytelling.
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  <a href="${avatarAdsUrl}" style="color:#111827;text-decoration:underline;font-size:16px;">Learn more about Avatar Ads →</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;font-size:20px;font-weight:600;">
                  🎬 Video Clone
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Start from a reference video and generate a version tailored to your product. Flowtra analyzes pacing, shot order, and visual structure so you can recreate the format with your own assets.
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  <a href="${videoCloneUrl}" style="color:#111827;text-decoration:underline;font-size:16px;">Learn more about Video Clone →</a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:32px;font-size:18px;font-weight:600;">
                  Ready to get started?
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Jump into your dashboard and create your first AI-powered video ad. Both tools are designed to be intuitive — you'll be generating professional ads in minutes.
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color:#111827;color:#ffffff;padding:14px 28px;border-radius:9999px;font-size:16px;font-weight:600;text-align:center;">
                        <a href="${appUrl}" style="color:#ffffff;text-decoration:none;display:inline-block;">Go to Dashboard</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:32px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Need help getting started? Reply to this email and it comes straight to me. I read every message from our users and I'm here to help.
                </td>
              </tr>
              <tr>
                <td style="padding-top:40px;font-size:14px;color:#9ca3af;">
                  Keep building,<br />Lantian Laoli<br />Founder, Flowtra
                </td>
              </tr>
              ${socialLinks.length > 0 ? `
              <tr>
                <td style="padding-top:32px;border-top:1px solid #e5e5e5;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                    <tr>
                      <td style="padding-top:20px;font-size:16px;font-weight:600;color:#111827;">
                        Connect with us
                      </td>
                    </tr>
                    ${socialLinks.map(link => `
                    <tr>
                      <td style="padding-top:12px;">
                        <a href="${link.href}" style="display:inline-block;color:#111827;text-decoration:none;font-size:15px;padding:8px 0;width:100%;border-bottom:1px solid #f3f4f6;">
                          <span style="font-weight:500;">${link.label}</span>
                        </a>
                      </td>
                    </tr>
                    `).join('')}
                  </table>
                </td>
              </tr>
              ` : ''}
            </table>
            <p style="margin-top:16px;font-size:12px;color:#9ca3af;">You're receiving this email because you created a Flowtra account.</p>
          </td>
        </tr>
      </table>
    </body>
  </html>`

  const text = `Welcome to Flowtra — Your AI Ad Studio

${greetingLine}

I'm Lantian Laoli, founder of Flowtra. You now have access to two powerful AI tools designed to help you create scroll-stopping video ads without agencies, studios, or creative teams.

🎭 AVATAR ADS
Create talking head videos where an AI character showcases your product or discusses any topic. Perfect for product demonstrations, educational content, and brand storytelling.

Learn more: ${avatarAdsUrl}

🎬 COMPETITOR REPLICA
Start from a reference video and generate a version tailored to your product. Flowtra analyzes pacing, shot order, and visual structure so you can recreate the format with your own assets.

Learn more: ${videoCloneUrl}

READY TO GET STARTED?
Jump into your dashboard and create your first AI-powered video ad. Both tools are designed to be intuitive — you'll be generating professional ads in minutes.

Go to Dashboard: ${appUrl}

Need help getting started? Reply to this email and it comes straight to me. I read every message from our users and I'm here to help.

Keep building,
Lantian Laoli
Founder, Flowtra${socialLinks.length > 0 ? `

────────────────────────────────

CONNECT WITH US

${socialLinks.map(link => `• ${link.label}\n  ${link.href}`).join('\n\n')}` : ''}`

  return await sendEmail({
    to: options.to,
    subject,
    html,
    text,
  })
}
