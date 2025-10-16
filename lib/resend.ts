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
  discountCode?: string | null
}) {
  const subject = 'Welcome to Flowtra — Here\'s 3% Off Your First Campaign'
  const siteBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowtra.store').replace(/\/$/, '')
  const appUrl = `${siteBase}/`
  const logoUrl = `${siteBase}/android-chrome-192x192.png`
  const code = (options.discountCode || '62NFXGGIFO').trim()
  const recipientName = options.name?.trim()

  const greetingLine = recipientName ? `Hi ${recipientName},` : 'Hi there,'

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
                        <img src="${logoUrl}" alt="Flowtra logo" width="32" height="32" style="display:block;border-radius:8px;" />
                      </td>
                      <td style="font-size:16px;letter-spacing:0.08em;font-weight:600;text-transform:uppercase;color:#111827;">Flowtra AI</td>
                      <td></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;font-size:28px;line-height:1.2;font-weight:600;">
                  Let\'s get your next campaign live
                </td>
              </tr>
              <tr>
                <td style="padding-top:16px;font-size:16px;line-height:1.6;color:#4b5563;">
                  ${greetingLine}<br />
                  I\'m Lantian Laoli, the founder of Flowtra. We built this platform so small teams like yours can ship scroll-stopping ads without chasing agencies, studios, or big budgets. Every dollar should push revenue forward, not disappear into production overhead.
                </td>
              </tr>
              <tr>
                <td style="padding-top:20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:16px;line-height:1.6;color:#4b5563;">
                    <tr>
                      <td width="16" valign="top" style="padding-right:8px;">-</td>
                      <td style="padding-bottom:8px;">Produce polished video ads for as low as <strong style="color:#111827;">$0.36 per run</strong>, so you can test ideas without burning budget.</td>
                    </tr>
                    <tr>
                      <td width="16" valign="top" style="padding-right:8px;">-</td>
                      <td style="padding-bottom:8px;">Generate and download unlimited product photos for free—perfect for keeping your socials, ads, and storefront fresh.</td>
                    </tr>
                    <tr>
                      <td width="16" valign="top" style="padding-right:8px;">-</td>
                      <td>Launch faster, stay visible longer, and keep conversions climbing with always-on creative testing.</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color:#111827;color:#ffffff;padding:14px 28px;border-radius:9999px;font-size:16px;font-weight:600;">
                        <a href="${appUrl}" style="color:#ffffff;text-decoration:none;">
                          Go to your dashboard
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:32px;font-size:18px;font-weight:600;">
                  Save 3% on your first package
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Use the code <strong style="color:#111827;">${code}</strong> at checkout to unlock a 3% discount on any credit pack. It\'s a founder\'s welcome gift to help you test your first ideas with less risk.
                </td>
              </tr>
              <tr>
                <td style="padding-top:32px;font-size:16px;line-height:1.6;color:#4b5563;">
                  Need a hand mapping Flowtra to your offer? Reply to this email and it comes straight to me. I read every message from fellow owners and I\'m happy to help.
                </td>
              </tr>
              <tr>
                <td style="padding-top:40px;font-size:14px;color:#9ca3af;">
                  Keep building,<br />Lantian Laoli<br />Founder, Flowtra
                </td>
              </tr>
            </table>
            <p style="margin-top:16px;font-size:12px;color:#9ca3af;">You\'re receiving this email because you created a Flowtra account.</p>
          </td>
        </tr>
      </table>
    </body>
  </html>`

  const text = `Welcome to Flowtra — Here\'s 3% Off Your First Campaign\n\n${greetingLine}\nI'm Lantian Laoli, founder of Flowtra. We built this platform so small teams can launch standout ads without agencies or big budgets. Every dollar should push revenue forward, not disappear into production overhead.\n\nWhat you'll find in your dashboard:\n- Video ads for as low as $0.36 per run, so you can test ideas without burning budget.\n- Unlimited product photo generation and downloads for free to keep every touchpoint fresh.\n- Faster launches that keep your brand visible and conversions climbing.\n\nGo to your dashboard: ${appUrl}\n\nUse code ${code} at checkout for 3% off any credit pack—my welcome gift to help you test your first ideas.\n\nNeed a hand tailoring Flowtra to your business? Reply to this email and it comes straight to me.\n\nKeep building,\nLantian Laoli\nFounder, Flowtra`

  return await sendEmail({
    to: options.to,
    subject,
    html,
    text,
  })
}

export async function sendNewUserNotification(options: {
  to?: string | string[]
  userId: string
  email?: string | null
  name?: string | null
}) {
  const notifyTo = options.to || process.env.NOTIFY_EMAIL_TO
  if (!notifyTo) {
    console.warn('sendNewUserNotification skipped: NOTIFY_EMAIL_TO not set')
    return { skipped: true }
  }

  const subject = 'New user first login'
  const displayName = options.name || options.email || options.userId
  const html = `
    <div>
      <h2>New user first login</h2>
      <p><strong>User ID:</strong> ${options.userId}</p>
      ${options.email ? `<p><strong>Email:</strong> ${options.email}</p>` : ''}
      ${options.name ? `<p><strong>Name:</strong> ${options.name}</p>` : ''}
      <p>Timestamp: ${new Date().toISOString()}</p>
    </div>
  `

  const text = `New user first login\nUser ID: ${options.userId}\n` +
    (options.email ? `Email: ${options.email}\n` : '') +
    (options.name ? `Name: ${options.name}\n` : '') +
    `Timestamp: ${new Date().toISOString()}`

  return await sendEmail({
    to: notifyTo,
    subject: `${subject}: ${displayName}`,
    html,
    text,
  })
}
