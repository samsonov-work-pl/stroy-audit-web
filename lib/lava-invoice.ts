import type { PaidTier } from '@/lib/audit-tier'

/**
 * Создание счёта Lava через API-интеграцию.
 * Вебхуки Lava приходят только по API-платежам (виджет платформы их не шлёт),
 * поэтому оплата сайта переведена с виджетов на инвойсы: сервер сам создаёт
 * счёт с email покупателя и ценой тарифа, покупатель платит на странице
 * Lava.top и возвращается на ?payment=success.
 */
export async function createLavaInvoice(apiBase: string, email: string, tier: PaidTier): Promise<string> {
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
  if (res.ok && paymentUrl) return paymentUrl
  const detail = pickString(data, ['detail', 'message', 'error'])
  throw new Error(detail || `Lava.top не создал счёт (HTTP ${res.status}). Попробуйте ещё раз.`)
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