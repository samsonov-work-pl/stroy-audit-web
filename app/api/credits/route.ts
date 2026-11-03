import { consumeCredit, creditBalance, normalizeCreditEmail, restoreCredit } from '@/lib/audit-credits'

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

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }
  const record = (body ?? {}) as { action?: unknown; email?: unknown; claimId?: unknown; plan?: unknown }
  if (record.action === 'restore') {
    const claimId = typeof record.claimId === 'string' ? record.claimId.trim() : ''
    if (!/^[0-9a-f-]{36}$/i.test(claimId)) return Response.json({ error: 'Некорректное списание.' }, { status: 400 })
    try {
      const restored = await restoreCredit(claimId)
      return Response.json({ restored })
    } catch (error) {
      console.error('[credits] restore failed:', error)
      return Response.json({ error: 'Не удалось вернуть проект на баланс.' }, { status: 503 })
    }
  }

  const email = normalizeCreditEmail(record.email)
  if (!email) return Response.json({ error: 'Укажите почту.' }, { status: 400 })
  // Легаси-режим списания (пока AUDIT_TICKET_SECRET не задан). Когда секрет
  // появляется, списание делает API аудита по тикету — из браузера больше нельзя.
  if (process.env.AUDIT_TICKET_SECRET?.trim()) {
    return Response.json(
      { code: 'credits_locked', error: 'Списание проектов теперь происходит автоматически при запуске отчёта.' },
      { status: 403 },
    )
  }
  try {
    const plan = record.plan === 'business' || record.plan === 'choice' || record.plan === 'full' ? record.plan : null
    const spent = await consumeCredit(email, plan)
    if (!spent) return Response.json({ error: 'На этой почте не осталось оплаченных проектов.' }, { status: 409 })
    return Response.json(spent)
  } catch (error) {
    console.error('[credits] consume failed:', error)
    return Response.json({ error: 'Не удалось списать проект.' }, { status: 503 })
  }
}
