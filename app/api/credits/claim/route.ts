import { claimAccessToken, ACCESS_TOKEN_PATTERN } from '@/lib/audit-access'
import { creditBalance, normalizeCreditEmail } from '@/lib/audit-credits'

/**
 * Выдаёт браузеру одноразовый ключ доступа к оплаченным проектам почты.
 * Ключ забирает тот, кто первым открывает сайт после оплаты, поэтому
 * знания чужого email для траты кредитов недостаточно.
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }
  const record = (body ?? {}) as { email?: unknown }
  const email = normalizeCreditEmail(record.email)
  if (!email) return Response.json({ error: 'Укажите почту.' }, { status: 400 })
  try {
    const token = await claimAccessToken(email)
    if (!token || !ACCESS_TOKEN_PATTERN.test(token)) {
      return Response.json({ token: null, remaining: await creditBalance(email) })
    }
    return Response.json({ token, remaining: await creditBalance(email) })
  } catch (error) {
    console.error('[credits/claim] failed:', error)
    return Response.json({ error: 'Не удалось открыть доступ к оплаченным проектам.' }, { status: 503 })
  }
}
