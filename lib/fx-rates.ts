import { isRubRates, type RubRates } from '@/lib/fx'

const DAY = 86_400
const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js'
const ER_URL = 'https://open.er-api.com/v6/latest/RUB'

type CbrQuote = { Nominal?: unknown; Value?: unknown }
type CbrPayload = { Date?: unknown; Valute?: { BYN?: CbrQuote; KZT?: CbrQuote } }
type ErPayload = { result?: unknown; time_last_update_utc?: unknown; rates?: { BYN?: unknown; KZT?: unknown } }

/** Official Bank of Russia quotes, cached for 24 hours. ExchangeRate-API is the fallback. */
export async function getRubRates(): Promise<RubRates | null> {
  const cbr = await readRates(CBR_URL, parseCbr)
  if (cbr) return cbr
  return readRates(ER_URL, parseEr)
}

async function readRates(url: string, parse: (payload: unknown) => RubRates | null) {
  try {
    const response = await fetch(url, {
      next: { revalidate: DAY },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const rates = parse(await response.json())
    return rates && isRubRates(rates) ? rates : null
  } catch {
    return null
  }
}

function quotePerRub(quote: CbrQuote | undefined) {
  if (!quote || typeof quote.Nominal !== 'number' || typeof quote.Value !== 'number') return null
  if (quote.Nominal <= 0 || quote.Value <= 0) return null
  return quote.Nominal / quote.Value
}

function parseCbr(payload: unknown): RubRates | null {
  const data = payload as CbrPayload
  const bynPerRub = quotePerRub(data?.Valute?.BYN)
  const kztPerRub = quotePerRub(data?.Valute?.KZT)
  if (bynPerRub == null || kztPerRub == null) return null
  return {
    bynPerRub,
    kztPerRub,
    updatedAt: typeof data.Date === 'string' ? data.Date : new Date().toISOString(),
  }
}

function parseEr(payload: unknown): RubRates | null {
  const data = payload as ErPayload
  if (data?.result !== 'success') return null
  if (typeof data.rates?.BYN !== 'number' || typeof data.rates?.KZT !== 'number') return null
  return {
    bynPerRub: data.rates.BYN,
    kztPerRub: data.rates.KZT,
    updatedAt: typeof data.time_last_update_utc === 'string' ? data.time_last_update_utc : new Date().toISOString(),
  }
}
