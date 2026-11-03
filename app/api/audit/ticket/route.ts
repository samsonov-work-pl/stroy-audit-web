import { createHmac, randomUUID } from 'node:crypto'

import { accessTokenEmail } from '@/lib/audit-access'
import { creditBalance, normalizeCreditEmail } from '@/lib/audit-credits'

/** Срок жизни тикета: файл должен успеть доехать до API аудита. */
const TICKET_TTL_SECONDS = 15 * 60

function ticketSecret() {
  return process.env.AUDIT_TICKET_SECRET?.trim() ?? ''
}

export async function POST(req: Request) {
  const secret = ticketSecret()
  if (!secret) {
    // Без секрета тикеты не выпускаем: подпись пустым ключом небезопасна.
    return Response.json(
      { code: 'ticket_secret_missing', error: 'Запуск отчётов временно недоступен. Попробуйте позже.' },
      { status: 500 },
    )
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }
  const record = (body ?? {}) as { email?: unknown; tier?: unknown; accessToken?: unknown }
  const email = normalizeCreditEmail(record.email)
  if (!email) return Response.json({ error: 'Укажите почту, на которую приходила оплата.' }, { status: 400 })
  const tier = record.tier === 'business' || record.tier === 'choice' || record.tier === 'full' ? record.tier : 'full'

  const tokenEmail = await accessTokenEmail(record.accessToken)
  if (!tokenEmail || tokenEmail !== email) {
    return Response.json(
      {
        code: 'invalid_token',
        error:
          'Оплаченные проекты открываются в браузере, где вы платили, или по ссылке из письма с отчётом.',
      },
      { status: 401 },
    )
  }
  try {
    if ((await creditBalance(email)) <= 0) {
      return Response.json(
        { code: 'no_credits', error: 'На этой почте не осталось оплаченных проектов.' },
        { status: 409 },
      )
    }
  } catch (error) {
    console.error('[audit/ticket] balance failed:', error)
    return Response.json({ error: 'Баланс проектов сейчас недоступен.' }, { status: 503 })
  }

  const payload = {
    v: 1,
    email,
    tier,
    jti: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  }
  const payloadText = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(payloadText).digest('base64url')
  return Response.json({ ticket: `${payloadText}.${signature}` })
}
