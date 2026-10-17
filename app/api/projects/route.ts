import { createProject, isChatTestMode, MAX_REPORT_CHARS } from '@/lib/chat-project'
import { emailHasPaidFullAudit } from '@/lib/payment-status'

const JURISDICTIONS = new Set(['russia', 'belarus', 'kazakhstan', 'eurocodes'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }
  const { report, jurisdiction, email } = (body ?? {}) as Record<string, unknown>

  if (typeof report !== 'string' || report.trim().length < 50 || report.length > MAX_REPORT_CHARS) {
    return Response.json({ error: 'Некорректный текст отчёта.' }, { status: 400 })
  }
  if (typeof jurisdiction !== 'string' || !JURISDICTIONS.has(jurisdiction)) {
    return Response.json({ error: 'Некорректная юрисдикция.' }, { status: 400 })
  }
  const safeEmail = typeof email === 'string' && EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null
  const paid = await emailHasPaidFullAudit(safeEmail)
  if (!isChatTestMode() && !paid) {
    return Response.json({ error: 'Чат доступен после подтверждения оплаты.' }, { status: 403 })
  }

  const token = await createProject({ report, jurisdiction, email: safeEmail, paid: paid || isChatTestMode() })
  return Response.json({ token })
}
