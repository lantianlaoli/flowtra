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
