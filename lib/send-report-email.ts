import { LEGAL_EMAIL } from '@/lib/legal'

type ReportMail = { to: string; url: string; days: number }

/** Sends the magic link. Returns false when mail is not configured or the provider rejects the letter. */
export async function sendReportEmail({ to, url, days }: ReportMail) {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim() || 'СтройАудит.ai <reports@stroyaudit-ai.com>'
  if (!key) return false
  const text = [
    'Ваш отчёт СтройАудит.ai готов.',
    '',
    `Ссылка на отчёт и чат активна ${days} дн.:`,
    url,
    '',
    'В чате по этому отчёту можно задать до 30 вопросов. Исходные файлы на сервере не хранятся.',
  ].join('\n')
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        reply_to: LEGAL_EMAIL,
        to: [to],
        subject: 'Ваш отчёт СтройАудит.ai',
        text,
      }),
    })
    return res.ok
  } catch (error) {
    console.error('[mail] resend failed:', error)
    return false
  }
}
