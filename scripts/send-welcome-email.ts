import { sendWelcomeEmail } from '../lib/resend'

async function main() {
  const recipient = process.argv[2] || process.env.WELCOME_EMAIL_TO
  const recipientName = process.argv[3]

  if (!recipient) {
    console.error('Usage: pnpm tsx scripts/send-welcome-email.ts <email> [name]')
    console.error('Or set WELCOME_EMAIL_TO in the environment and rerun the script.')
    process.exit(1)
  }

  try {
    const result = await sendWelcomeEmail({
      to: recipient,
      name: recipientName,
    })
    console.log('Resend API response:', result)
  } catch (error) {
    console.error('Failed to send welcome email.')
    console.error(error)
    process.exit(1)
  }
}

void main()
