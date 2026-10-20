export const PAID_TIERS = ['full', 'developer'] as const

export type PaidTier = (typeof PAID_TIERS)[number]

const STORAGE_KEY = 'stroyaudit:tier'

export const TIER_EVENT = 'stroyaudit-tier'

export function isPaidTier(value: unknown): value is PaidTier {
  return value === 'full' || value === 'developer'
}

export function paymentSuccessUrl(origin: string, tier: PaidTier) {
  return `${origin.replace(/\/$/, '')}/?payment=success&tier=${tier}`
}

export function saveSelectedTier(tier: PaidTier) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, tier)
  } catch {}
  window.dispatchEvent(new Event(TIER_EVENT))
}

/** Tariff explicitly chosen on the pricing cards or returned by Lava.top. */
export function loadStoredTier(): PaidTier | null {
  if (typeof window === 'undefined') return null
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('tier')
    if (isPaidTier(fromQuery)) return fromQuery
  } catch {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isPaidTier(stored)) return stored
  } catch {}
  return null
}

/** Paid audit tier sent to the deep-audit endpoint. Defaults to the standard drawing audit. */
export function loadSelectedTier(): PaidTier {
  const selected = loadStoredTier()
  if (selected && typeof window !== 'undefined') {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('tier')
      if (fromQuery === selected) localStorage.setItem(STORAGE_KEY, selected)
    } catch {}
  }
  return selected ?? 'full'
}
