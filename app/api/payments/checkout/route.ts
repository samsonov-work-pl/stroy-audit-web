import { normalizeEmail } from '@/lib/payment-status'

const LAVA_INVOICE_URL = 'https://gate.lava.top/api/v3/invoice'
const FALLBACK_OFFER_ID = '46156488-439c-4f84-86b9-7628f5a6e93e'

const CURRENCY: Record<string, string> = {
  russia: 'RUB',
  belarus: 'BYN',
  kazakhstan: 'KZT',
  eurocodes: 'EUR',
}

function offerId() {
  const raw = process.env.LAVA_OFFER_FULL || process.env.LAVA_PRODUCT_FULL || FALLBACK_OFFER_ID
  return raw.split(',')[0]?.trim() || FALLBACK_OFFER_ID
}

function paymentUrlFrom(data: unknown) {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  for (const key of ['paymentUrl', 'payment_url', 'url', 'confirmationUrl']) {
    const value = record[key]
    if (typeof value === 'string' && value.startsWith('https://')) return value
  }
  return null
}

export async function POST(req: Request) {
  const apiKey = process.env.LAVA_API_KEY?.trim()
  if (!apiKey) return Response.json({ paymentUrl: null })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ paymentUrl: null })
  }
  const { email, jurisdiction } = (body ?? {}) as { email?: unknown; jurisdiction?: unknown }
  const buyer = normalizeEmail(typeof email === 'string' ? email : null)
  if (!buyer) return Response.json({ paymentUrl: null })

  const origin = req.headers.get('origin')
  if (!origin?.startsWith('https://')) return Response.json({ paymentUrl: null })
  const successUrl = `${origin}/?payment=success`
  const currency = CURRENCY[typeof jurisdiction === 'string' ? jurisdiction : ''] ?? 'RUB'

  try {
    const res = await fetch(LAVA_INVOICE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        email: buyer,
        offerId: offerId(),
        currency,
        buyerLanguage: 'RU',
        successful_return_url: successUrl,
        failure_return_url: `${origin}/?payment=failed`,
        cancel_return_url: origin,
      }),
    })
    const data: unknown = await res.json().catch(() => null)
    const paymentUrl = paymentUrlFrom(data)
    if (!res.ok || !paymentUrl) return Response.json({ paymentUrl: null })
    return Response.json({ paymentUrl })
  } catch {
    return Response.json({ paymentUrl: null })
  }
}
