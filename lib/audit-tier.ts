export const PAID_TIERS = ['full', 'developer'] as const

export type PaidTier = (typeof PAID_TIERS)[number]

export type AuditTier = 'express' | PaidTier

const STORAGE_KEY = 'stroyaudit:tier'

export const TIER_EVENT = 'stroyaudit-tier'

/** Thin frame shared by a tariff card, the upload form, and its pay button. */
export const TIER_FRAME_COLOR: Record<AuditTier, string> = {
  express: '#16a34a',
  full: '#ca8a04',
  developer: '#16a34a',
}

export function isPaidTier(value: unknown): value is PaidTier {
  return value === 'full' || value === 'developer'
}

export function isAuditTier(value: unknown): value is AuditTier {
  return value === 'express' || isPaidTier(value)
}

export function saveAuditChoice(tier: AuditTier) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, tier)
  } catch {}
  window.dispatchEvent(new Event(TIER_EVENT))
}

export function saveSelectedTier(tier: PaidTier) {
  saveAuditChoice(tier)
}

/** Tariff highlighted on the pricing cards and the upload form. */
export function loadAuditChoice(): AuditTier | null {
  if (typeof window === 'undefined') return null
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('tier')
    if (isAuditTier(fromQuery)) return fromQuery
  } catch {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isAuditTier(stored)) return stored
  } catch {}
  return null
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
