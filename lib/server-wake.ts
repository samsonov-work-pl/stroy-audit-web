/**
 * Пробуждение API на Render Free: инстанс засыпает через ~15 минут без трафика,
 * а спящий роутер может мгновенно ответить 404 (заголовок x-render-routing: no-server),
 * не доводя запрос до инстанса. GET / роутер держит открытым до ответа приложения,
 * поэтому один такой запрос и будит инстанс, и подтверждает, что он отвечает.
 * Сайт не использует cookies: отметка «сервер проснулся» живёт в localStorage,
 * как и остальные ключи stroyaudit:*.
 */

const API_ORIGIN = 'https://stroy-audit-api.onrender.com'
const STORAGE_KEY = 'stroyaudit:server-awake-at'

/** Пингуем не чаще раза в 10 минут: Render Free засыпает через 15 минут простоя. */
export const WAKE_INTERVAL_MS = 10 * 60_000

/** Сколько раз повторять пинг, если сервер так и не ответил. */
const WAKE_ATTEMPTS = 3

export function getLastAwakeAt(): number {
  if (typeof window === 'undefined') return 0
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function isAwakeWithin(intervalMs: number = WAKE_INTERVAL_MS): boolean {
  const last = getLastAwakeAt()
  return last > 0 && Date.now() - last < intervalMs
}

export function markServerAwake(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {}
}

/** Ответ от роутера Render вместо инстанса — значит, сервер ещё спит. */
export function isRouterReply(res: Response): boolean {
  return res.headers.get('x-render-routing') === 'no-server'
}

/** Один пинг. true — ответил сам инстанс (проснулся или был проснувшимся). */
export async function pingServer(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_ORIGIN}/?wake=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal,
    })
    if (isRouterReply(res)) return false
    markServerAwake()
    return true
  } catch {
    return false
  }
}

/** Пинг до успеха (до WAKE_ATTEMPTS попыток). Возвращает true, если сервер отвечает. */
export async function ensureServerAwake(signal?: AbortSignal): Promise<boolean> {
  for (let attempt = 0; attempt < WAKE_ATTEMPTS; attempt++) {
    if (await pingServer(signal)) return true
  }
  return false
}
