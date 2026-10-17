'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'stroyaudit:last-audit-submitted-at'

function readLastSubmittedAt() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function useSubmitCooldown(durationMs: number) {
  const [lastSubmittedAt, setLastSubmittedAt] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    setLastSubmittedAt(readLastSubmittedAt())
    setNow(Date.now())

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setLastSubmittedAt(readLastSubmittedAt())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const endsAt = lastSubmittedAt + durationMs

  useEffect(() => {
    if (endsAt <= Date.now()) return
    setNow(Date.now())
    const id = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= endsAt) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [endsAt])

  /** Starts the cooldown. `lockForMs` overrides the duration, e.g. from a server Retry-After header. */
  const start = useCallback(
    (lockForMs: number = durationMs) => {
      const stamp = Date.now() + lockForMs - durationMs
      try {
        window.localStorage.setItem(STORAGE_KEY, String(stamp))
      } catch {}
      setLastSubmittedAt(stamp)
      setNow(Date.now())
    },
    [durationMs],
  )

  const secondsLeft = now ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0

  return { secondsLeft, active: secondsLeft > 0, start }
}
