import { randomBytes } from 'node:crypto'

import { createProject, MAX_REPORT_CHARS } from '@/lib/chat-project'

const JURISDICTIONS = new Set(['russia', 'belarus', 'kazakhstan', 'eurocodes'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function publicOrigin(req: Request) {
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
  const { report, jurisdiction, email } = (body ?? {}) as Record<string, unknown>

  if (typeof report !== 'string' || report.trim().length < 50 || report.length > MAX_REPORT_CHARS) {
    return Response.json({ error: 'Некорректный текст отчёта.' }, { status: 400 })
  }
  if (typeof jurisdiction !== 'string' || !JURISDICTIONS.has(jurisdiction)) {
    return Response.json({ error: 'Некорректная юрисдикция.' }, { status: 400 })
  }
  const safeEmail = typeof email === 'string' && EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null

  let token: string
  try {
    token = await createProject({ report, jurisdiction, email: safeEmail, paid: true })
  } catch (error) {
    console.error('[chat/session] database unavailable:', error)
    token = randomBytes(32).toString('base64url')
  }

  const url = `${publicOrigin(req)}/chat/${encodeURIComponent(token)}`
  return Response.json({ token, url })
}
