import { isPaidTier, type PaidTier } from '@/lib/audit-tier'

/** Official Lava.top Web-Widget iframe, generated in the cabinet for one product and domain. */
const WIDGET_HOST = 'https://widget.lava.top'
const WIDGET_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export const PAYMENT_CHANNEL = 'stroyaudit-payment'
export const PAYMENT_SIGNAL_KEY = 'stroyaudit:payment-success'
const REPORT_LOCK_KEY = 'stroyaudit:report-lock'
const REPORT_LOCK_MS = 2 * 60 * 1000

export type PaymentSuccessMessage = {
  type: 'stroyaudit:payment-success'
  tier: PaidTier
}

/** Accepts a widget UUID or the HTML/URL copied from Lava.top. */
export function parseWidgetId(raw: string | null | undefined) {
  const match = raw?.match(WIDGET_ID)
  return match?.[0] ?? null
}

export function lavaWidgetId(tier: PaidTier) {
  const raw =
    tier === 'developer'
      ? process.env.NEXT_PUBLIC_LAVA_WIDGET_DEVELOPER
      : process.env.NEXT_PUBLIC_LAVA_WIDGET_FULL
  return parseWidgetId(raw)
}

export function lavaWidgetSrc(widgetId: string) {
  return `${WIDGET_HOST}/${widgetId}`
}

export function publishPaymentSuccess(tier: PaidTier) {
  const message: PaymentSuccessMessage = { type: 'stroyaudit:payment-success', tier }
  try {
    localStorage.setItem(PAYMENT_SIGNAL_KEY, JSON.stringify({ ...message, at: Date.now() }))
  } catch {}
  try {
    const channel = new BroadcastChannel(PAYMENT_CHANNEL)
    channel.postMessage(message)
    channel.close()
  } catch {}
  try {
    if (window.opener && window.opener !== window && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin)
    }
  } catch {}
}

export function paymentSuccessFromStorage(raw: string | null): PaidTier | null {
  if (!raw) return null
  try {
    const tier = (JSON.parse(raw) as { tier?: unknown }).tier
    return isPaidTier(tier) ? tier : null
  } catch {
    return null
  }
}

/** A paid tier from our own window, or `true` when Lava confirms payment without naming the tariff. */
export function paymentSuccessFromMessage(event: MessageEvent): PaidTier | true | null {
  if (event.origin === window.location.origin) {
    const data = event.data as Partial<PaymentSuccessMessage> | null
    if (data?.type === 'stroyaudit:payment-success' && isPaidTier(data.tier)) return data.tier
    return null
  }
  if (!isLavaPaymentSuccess(event)) return null
  const tier = event.data && typeof event.data === 'object' ? (event.data as { tier?: unknown }).tier : null
  return isPaidTier(tier) ? tier : true
}

function isLavaPaymentSuccess(event: MessageEvent) {
  let host = ''
  try {
    host = new URL(event.origin).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host !== 'lava.top' && !host.endsWith('.lava.top')) return false
  if (!event.data || typeof event.data !== 'object') return false
  const record = event.data as Record<string, unknown>
  const status = [record.status, record.event, record.eventType, record.event_type, record.type]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  if (/fail|cancel|error/.test(status)) return false
  return status === 'paid' || /(^|[^a-z])success([^a-z]|$)/.test(status)
}

/** One tab starts the paid report. The lock expires so a failed attempt can be retried. */
export function claimReportGeneration() {
  const now = Date.now()
  try {
    const prev = Number(localStorage.getItem(REPORT_LOCK_KEY) || 0)
    if (prev && now - prev < REPORT_LOCK_MS) return false
    localStorage.setItem(REPORT_LOCK_KEY, String(now))
  } catch {}
  return true
}

export function releaseReportGeneration() {
  try {
    localStorage.removeItem(REPORT_LOCK_KEY)
  } catch {}
}
