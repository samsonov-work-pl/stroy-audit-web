import { pool } from '@/lib/db'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let tableReady: Promise<void> | null = null

export function normalizeCreditEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null
  return email
}

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function ensureCreditTables() {
  if (!databaseConfigured()) return Promise.reject(new Error('DATABASE_URL не задан'))
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_credits (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          payment_event_id TEXT UNIQUE,
          contract_id TEXT,
          plan TEXT NOT NULL,
          granted INTEGER NOT NULL,
          remaining INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await pool.query('CREATE INDEX IF NOT EXISTS audit_credits_email_idx ON audit_credits (email)')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_credit_uses (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          credit_id TEXT NOT NULL,
          restored BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
    })()
      .then(() => undefined)
      .catch((error) => {
        tableReady = null
        throw error
      })
  }
  return tableReady
}

export async function creditBalance(email: string) {
  await ensureCreditTables()
  const result = await pool.query<{ remaining: number }>(
    'SELECT COALESCE(SUM(remaining), 0)::int AS remaining FROM audit_credits WHERE email = $1',
    [email],
  )
  return result.rows[0]?.remaining ?? 0
}
