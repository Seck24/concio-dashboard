import twilio from 'twilio'

function getClient() {
  return twilio(
    process.env.TWILIO_API_KEY_SID!,
    process.env.TWILIO_API_KEY_SECRET!,
    { accountSid: process.env.TWILIO_ACCOUNT_SID! }
  )
}

export async function sendSMS(to: string, body: string) {
  const from = process.env.TWILIO_PHONE_NUMBER!
  return getClient().messages.create({ to, from, body })
}
