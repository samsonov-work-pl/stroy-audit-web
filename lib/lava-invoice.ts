import type { PaidTier } from '@/lib/audit-tier'

/** Ключ в localStorage: id последнего созданного счёта Lava. */
const PENDING_INVOICE_KEY = 'stroyaudit:pending-invoice'

/** Данные, которые возвращает API при создании счёта Lava. */
export type LavaInvoice = { paymentUrl: string; invoiceId: string | null }

/**
 * Создание счёта Lava через API-интеграцию.
 * Вебхуки Lava приходят только по API-платежам (виджет платформы их не шлёт),
 * поэтому оплата сайта переведена с виджетов на инвойсы: сервер сам создаёт
 * счёт с email покупателя и ценой тарифа, покупатель платит на странице
 * Lava.top и возвращается на ?payment=success.
 */
export async function createLavaInvoice(apiBase: string, email: string, tier: PaidTier): Promise<LavaInvoice> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(`${apiBase.replace(/\/$/, '')}/api/invoice/lava`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tier }),
      signal: controller.signal,
    })
  } catch {
    throw new Error('Не удалось связаться с сервером оплаты. Проверьте подключение и попробуйте ещё раз.')
  } finally {
    clearTimeout(timeout)
  }
  const raw = await res.text()
  let data: unknown = raw
  try {
    data = JSON.parse(raw)
  } catch {}
  const paymentUrl = pickString(data, ['paymentUrl', 'payment_url', 'url'])
  if (res.ok && paymentUrl) {
    return { paymentUrl, invoiceId: pickString(data, ['invoiceId', 'invoice_id', 'id']) }
  }
  const detail = pickString(data, ['detail', 'message', 'error'])
  throw new Error(detail || `Lava.top не создал счёт (HTTP ${res.status}). Попробуйте ещё раз.`)
}

/**
 * Проверка счёта после возврата с оплаты: сервер сам спрашивает Lava API,
 * оплачен ли счёт, и начисляет кредиты. Страховка от потерянного вебхука.
 * Возвращает true, если кредиты начислены (или уже были начислены ранее).
 */
export async function verifyLavaInvoice(apiBase: string, invoiceId: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/invoice/lava/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
      signal: AbortSignal.timeout(30_000),
    })
    const data: unknown = await res.json().catch(() => null)
    return Boolean(data && typeof data === 'object' && (data as Record<string, unknown>).ok === true)
  } catch {
    return false
  }
}

/** Запоминает id счёта до перехода на оплату: после возврата с Lava по нему
 * запустится проверка оплаты. */
export function rememberPendingInvoice(invoiceId: string) {
  try {
    localStorage.setItem(PENDING_INVOICE_KEY, invoiceId)
  } catch {}
}

/** Достаёт id последнего счёта (не удаляя: повторный возврат с оплаты должен
 * снова запускать проверку). */
export function recallPendingInvoice(): string | null {
  try {
    const value = localStorage.getItem(PENDING_INVOICE_KEY)
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

/** Убирает запомненный счёт, когда кредиты подтверждены. */
export function clearPendingInvoice() {
  try {
    localStorage.removeItem(PENDING_INVOICE_KEY)
  } catch {}
}

function pickString(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}
