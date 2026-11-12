import type { Jurisdiction } from '@/components/jurisdiction-provider'

const STORAGE_KEY = 'stroyaudit:last-audit'
const DB_NAME = 'stroyaudit'
const FILE_STORE = 'files'
const FILE_KEY = 'last-audit-file'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type DeepReport = { pdfUrl: string | null; report: string | null; chatUrl?: string | null }

export type StoredAudit = {
  savedAt: number
  httpStatus: number
  data: unknown
  jurisdiction: Jurisdiction
  templateWarning: string | null
  email: string
  deep: DeepReport | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withFileStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(FILE_STORE, mode).objectStore(FILE_STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export function loadStoredAudit(): StoredAudit | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAudit
    if (!parsed || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearStoredAudit()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveStoredAudit(audit: Omit<StoredAudit, 'savedAt' | 'deep'>, files: File[] | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...audit, deep: null, savedAt: Date.now() }))
  } catch {}
  if (files && files.length > 0) withFileStore('readwrite', (store) => store.put(files, FILE_KEY)).catch(() => {})
}

export function saveDeepReport(deep: DeepReport) {
  const current = loadStoredAudit()
  if (!current) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, deep }))
  } catch {}
}

export async function loadStoredFile(): Promise<File | null> {
  const files = await loadStoredFiles()
  return files.length > 0 ? files[0] : null
}

export async function loadStoredFiles(): Promise<File[]> {
  try {
    const value = await withFileStore<unknown>('readonly', (store) => store.get(FILE_KEY))
    // Старый формат хранения — одиночный File; новый — массив файлов запуска.
    if (value instanceof File) return [value]
    if (Array.isArray(value)) return value.filter((item): item is File => item instanceof File)
    return []
  } catch {
    return []
  }
}

export function clearStoredAudit() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
  withFileStore('readwrite', (store) => store.delete(FILE_KEY)).catch(() => {})
}
