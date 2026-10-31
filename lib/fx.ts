/** Paid prices are always charged in Russian rubles. BYN and KZT are display-only. */
/** Display prices. They must match the Lava.top products; the widget charges the cabinet price. */
export const TARIFF_RUB = {
  express: 0,
  full: 50,
  choice: 100,
  business: 150,
} as const

export type TariffId = keyof typeof TARIFF_RUB

/** How many units of the foreign currency one ruble buys. */
export type RubRates = {
  bynPerRub: number
  kztPerRub: number
  updatedAt: string
}

export const currencyFont = 'font-[family-name:var(--font-currency)]'

const grouped = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function isRubRates(value: unknown): value is RubRates {
  if (!value || typeof value !== 'object') return false
  const rates = value as Partial<RubRates>
  return (
    typeof rates.updatedAt === 'string' &&
    saneRate(rates.bynPerRub, 0.01, 0.2) &&
    saneRate(rates.kztPerRub, 1, 20)
  )
}

function saneRate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function formatGrouped(amount: number) {
  return grouped.format(amount)
}

export function referenceAmounts(amountRub: number, rates: RubRates) {
  const byn = Math.round(amountRub * rates.bynPerRub)
  const kzt = Math.round((amountRub * rates.kztPerRub) / 100) * 100
  if (byn <= 0 || kzt <= 0) return null
  return { byn, kzt }
}
