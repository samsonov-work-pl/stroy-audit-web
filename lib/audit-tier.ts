import { TARIFF_RUB, formatGrouped } from '@/lib/fx'

export const PAID_TIERS = ['full', 'choice', 'business'] as const

export type PaidTier = (typeof PAID_TIERS)[number]

export type AuditTier = 'express' | PaidTier

const STORAGE_KEY = 'stroyaudit:tier'

export const TIER_EVENT = 'stroyaudit-tier'

/** Thin frame shared by a tariff card, the upload form, and its pay button. */
export const TIER_FRAME_COLOR: Record<AuditTier, string> = {
  express: '#16a34a',
  full: '#ca8a04',
  choice: '#2563eb',
  business: '#7c3aed',
}

/** Публичное имя, цвета градиента и краткие тексты тарифа для карточки и окна загрузки. */
export type TierMeta = {
  name: string
  /** Начало градиента: рамка выбранной карточки, контур окна загрузки, кнопка «Выбран». */
  color: string
  /** Конец градиента, используется вместе с `color`. */
  gradientTo: string
  /** Краткая подсказка в окне загрузки; полное описание остаётся на карточке тарифа. */
  hint: string
  /** Правая часть кнопки запуска для платных тарифов. */
  thenLabel: string | null
}

export const TIER_META: Record<AuditTier, TierMeta> = {
  express: {
    name: 'Экспресс',
    color: '#16a34a',
    gradientTo: '#65a30d',
    hint: 'Бесплатный экспресс-анализ за несколько минут: загрузите проект и сразу увидите количество ошибок и первые критические замечания без оплаты и привязки карты.',
    thenLabel: null,
  },
  full: {
    name: 'Полный аудит',
    color: '#ca8a04',
    gradientTo: '#ea580c',
    hint: 'Загрузите проект — сначала бесплатный экспресс-разбор.',
    thenLabel: 'затем тариф Полный аудит',
  },
  choice: {
    name: 'Выбор застройщика',
    color: '#2563eb',
    gradientTo: '#06b6d4',
    hint: 'Загрузите первый из 3 проектов — сначала бесплатный экспресс-разбор.',
    thenLabel: 'затем тариф Выбор застройщика',
  },
  business: {
    name: 'Профи / Бизнес',
    color: '#7c3aed',
    gradientTo: '#db2777',
    hint: 'Загрузите первый из 10 проектов — сначала бесплатный экспресс-разбор.',
    thenLabel: 'затем тариф Профи / Бизнес',
  },
}

/** «990 ₽»-подпись для бейджа тарифа и сегмента кнопки запуска. Бесплатный тариф возвращает null. */
export function tierPriceText(tier: AuditTier) {
  const rub = TARIFF_RUB[tier]
  return rub > 0 ? `${formatGrouped(rub)} ₽` : null
}

export function isPaidTier(value: unknown): value is PaidTier {
  return value === 'full' || value === 'choice' || value === 'business'
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
