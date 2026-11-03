'use client'

import { useEffect } from 'react'

const ACCESS_STORAGE_KEY = 'stroyaudit:access-token'

/**
 * Сохраняет ключ доступа из ссылки (?key=...) в localStorage браузера.
 * Так оплаченные проекты открываются на любом устройстве по ссылке из
 * письма с отчётом, без входа в личный кабинет.
 */
export function CaptureAccessKey() {
  useEffect(() => {
    try {
      const query = new URLSearchParams(window.location.search)
      const key = query.get('key')
      if (!key || !/^[A-Za-z0-9_-]{32,64}$/.test(key)) return
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify({ token: key }))
      query.delete('key')
      window.history.replaceState(null, '', `${window.location.pathname}${query.size ? `?${query}` : ''}`)
    } catch {}
  }, [])
  return null
}
