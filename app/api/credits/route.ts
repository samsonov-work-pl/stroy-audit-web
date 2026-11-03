import { creditBalance, normalizeCreditEmail } from '@/lib/audit-credits'

export async function GET(req: Request) {
  const email = normalizeCreditEmail(new URL(req.url).searchParams.get('email'))
  if (!email) return Response.json({ error: 'Укажите почту.' }, { status: 400 })
  try {
    return Response.json({ remaining: await creditBalance(email) })
  } catch (error) {
    console.error('[credits] balance failed:', error)
    return Response.json({ error: 'Баланс проектов сейчас недоступен.' }, { status: 503 })
  }
}
