import { MAX_REPORT_CHARS } from '@/lib/chat-project'
import { createReportSession, isSessionTier } from '@/lib/report-session'
import { sendReportEmail } from '@/lib/send-report-email'

const JURISDICTIONS = new Set(['russia', 'belarus', 'kazakhstan', 'eurocodes'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function publicOrigin(req: Request) {
  const configured = process.env.SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const requestUrl = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  if (!host) return requestUrl.origin
  return `${proto}://${host}`
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }
  const { report, jurisdiction, email, tier } = (body ?? {}) as Record<string, unknown>
  if (typeof report !== 'string' || report.trim().length < 50 || report.length > MAX_REPORT_CHARS) {
    return Response.json({ error: 'Некорректный текст отчёта.' }, { status: 400 })
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return Response.json({ error: 'Укажите email, на который отправить отчёт.' }, { status: 400 })
  }
  if (!isSessionTier(tier)) {
    return Response.json({ error: 'Некорректный тариф.' }, { status: 400 })
  }
  const safeJurisdiction = typeof jurisdiction === 'string' && JURISDICTIONS.has(jurisdiction) ? jurisdiction : null

  try {
    const session = await createReportSession({
      email: email.trim().toLowerCase(),
      report,
      tier,
      jurisdiction: safeJurisdiction,
    })
    const url = `${publicOrigin(req)}/report/${session.token}`
    const emailSent = await sendReportEmail({ to: email.trim(), url, days: session.days })
    return Response.json({
      token: session.token,
      url,
      days: session.days,
      expiresAt: session.expiresAt.toISOString(),
      emailSent,
    })
  } catch (error) {
    console.error('[report/session] failed:', error)
    return Response.json({ error: 'Не удалось сохранить отчёт.' }, { status: 503 })
  }
}
