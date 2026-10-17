import { emailHasPaidFullAudit, normalizeEmail } from '@/lib/payment-status'

export async function GET(req: Request) {
  const email = normalizeEmail(new URL(req.url).searchParams.get('email'))
  if (!email) return Response.json({ paid: false })
  const paid = await emailHasPaidFullAudit(email)
  return Response.json({ paid })
}
