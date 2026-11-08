'use client'

import { useEffect, useRef } from 'react'
import { ensureServerAwake, isAwakeWithin, WAKE_INTERVAL_MS } from '@/lib/server-wake'

/**
 * Держим API «тёплым» на живом трафике: фоновый пинг при заходе на сайт
 * и при возврате пользователя после простоя, но не чаще раза в 10 минут
 * и только когда сервер, по нашим данным, давно не отвечал.
 * Пинг тихий — интерфейс ничего не показывает.
 */
export function useServerWake() {
  const pendingRef = useRef(false)

  useEffect(() => {
    function wakeIfStale() {
      if (pendingRef.current || isAwakeWithin(WAKE_INTERVAL_MS)) return
      pendingRef.current = true
      ensureServerAwake().finally(() => {
        pendingRef.current = false
      })
    }

    function onVisible() {
      if (document.visibilityState === 'visible') wakeIfStale()
    }

    // Возврат после долгого простоя: проверяем свежесть сервера
    // на первом движении пользователя, но не чаще раза в минуту.
    let lastActivityCheck = Date.now()
    function onActivity() {
      const now = Date.now()
      if (now - lastActivityCheck < 60_000) return
      lastActivityCheck = now
      wakeIfStale()
    }

    wakeIfStale()
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
  }, [])
}
