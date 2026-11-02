import { randomUUID } from 'node:crypto'

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

/** Takes one paid project, preferring the tariff just purchased. Returns null when the email has none left. */
export async function consumeCredit(email: string, preferredPlan?: string | null) {
  await ensureCreditTables()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{ id: string; plan: string }>(
      `SELECT id, plan FROM audit_credits
       WHERE email = $1 AND remaining > 0
       ORDER BY CASE WHEN plan = $2 THEN 0 ELSE 1 END, created_at
       LIMIT 1
       FOR UPDATE`,
      [email, preferredPlan ?? ''],
    )
    const credit = found.rows[0]
    if (!credit) {
      await client.query('ROLLBACK')
      return null
    }
    await client.query('UPDATE audit_credits SET remaining = remaining - 1 WHERE id = $1', [credit.id])
    const claimId = randomUUID()
    await client.query('INSERT INTO audit_credit_uses (id, email, credit_id) VALUES ($1, $2, $3)', [
      claimId,
      email,
      credit.id,
    ])
    const sum = await client.query<{ remaining: number }>(
      'SELECT COALESCE(SUM(remaining), 0)::int AS remaining FROM audit_credits WHERE email = $1',
      [email],
    )
    await client.query('COMMIT')
    return { claimId, remaining: sum.rows[0]?.remaining ?? 0, plan: credit.plan }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function restoreCredit(claimId: string) {
  await ensureCreditTables()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const use = await client.query<{ credit_id: string }>(
      `UPDATE audit_credit_uses
       SET restored = TRUE
       WHERE id = $1 AND restored = FALSE
       RETURNING credit_id`,
      [claimId],
    )
    const creditId = use.rows[0]?.credit_id
    if (!creditId) {
      await client.query('ROLLBACK')
      return false
    }
    await client.query('UPDATE audit_credits SET remaining = remaining + 1 WHERE id = $1', [creditId])
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
