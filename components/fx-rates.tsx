'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isRubRates, type RubRates } from '@/lib/fx'

const STORAGE_KEY = 'stroyaudit:rub-rates'
const DAY_MS = 86_400_000

const FxRatesContext = createContext<RubRates | null>(null)

let memory: { savedAt: number; rates: RubRates } | null = null

function rememberRates(rates: RubRates) {
  memory = { savedAt: Date.now(), rates }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {}
}

function readStoredRates() {
  if (memory && Date.now() - memory.savedAt < DAY_MS && isRubRates(memory.rates)) return memory.rates
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as { savedAt?: unknown; rates?: unknown }
    if (typeof stored.savedAt !== 'number' || Date.now() - stored.savedAt >= DAY_MS) return null
    if (!isRubRates(stored.rates)) return null
    memory = { savedAt: stored.savedAt, rates: stored.rates }
    return stored.rates
  } catch {
    return null
  }
}

export function FxRatesProvider({ rates, children }: { rates: RubRates | null; children: ReactNode }) {
  useEffect(() => {
    if (rates) rememberRates(rates)
  }, [rates])

  return <FxRatesContext.Provider value={rates}>{children}</FxRatesContext.Provider>
}

/** Server rates when the page fetched them; otherwise the 24-hour browser cache, then `/api/fx`. */
export function useRubRates() {
  const fromServer = useContext(FxRatesContext)
  const [fetched, setFetched] = useState<RubRates | null>(null)

  useEffect(() => {
    if (fromServer) return
    const stored = readStoredRates()
    if (stored) {
      setFetched(stored)
      return
    }
    let cancelled = false
    fetch('/api/fx')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || !isRubRates(payload)) return
        rememberRates(payload)
        setFetched(payload)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [fromServer])

  return fromServer ?? fetched
}
