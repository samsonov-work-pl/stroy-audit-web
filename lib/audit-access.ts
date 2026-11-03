import { createHash, randomBytes } from 'node:crypto'

import { pool } from '@/lib/db'

export const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/

let tablesReady: Promise<void> | null = null

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

function ensureTables() {
  if (!databaseConfigured()) return Promise.reject(new Error('DATABASE_URL не задан'))
  if (!tablesReady) {
    tablesReady = pool
      .query(`
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
      .then(() => pool.query('CREATE INDEX IF NOT EXISTS audit_credits_email_idx ON audit_credits (email)'))
      .then(() => pool.query('ALTER TABLE audit_credits ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ'))
      .then(() =>
        pool.query(`
          CREATE TABLE IF NOT EXISTS credit_access_tokens (
            token_hash TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `),
      )
      .then(() =>
        pool.query('CREATE INDEX IF NOT EXISTS credit_access_tokens_email_idx ON credit_access_tokens (email)'),
      )
      .then(() => undefined)
      .catch((error) => {
        tablesReady = null
        throw error
      })
  }
  return tablesReady
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Один раз выдаёт браузеру ключ доступа к оплаченным проектам почты.
 * Ключ получает тот, кто первым забрал свежую порцию кредитов после
 * оплаты, поэтому знания одного email для траты кредитов мало.
 */
export async function claimAccessToken(email: string) {
  await ensureTables()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{ id: string }>(
      `SELECT id FROM audit_credits
       WHERE email = $1 AND claimed_at IS NULL
       ORDER BY created_at
       FOR UPDATE`,
      [email],
    )
    const ids = found.rows.map((row) => row.id)
    if (ids.length === 0) {
      await client.query('ROLLBACK')
      return null
    }
    const token = randomBytes(32).toString('base64url')
    await client.query('INSERT INTO credit_access_tokens (token_hash, email) VALUES ($1, $2)', [
      hashToken(token),
      email,
    ])
    await client.query('UPDATE audit_credits SET claimed_at = NOW() WHERE id = ANY($1::text[])', [ids])
    await client.query('COMMIT')
    return token
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Проверяет ключ доступа и возвращает email, к которому он привязан. */
export async function accessTokenEmail(token: unknown) {
  if (typeof token !== 'string' || !ACCESS_TOKEN_PATTERN.test(token)) return null
  try {
    await ensureTables()
    const result = await pool.query<{ email: string }>(
      'SELECT email FROM credit_access_tokens WHERE token_hash = $1',
      [hashToken(token)],
    )
    return result.rows[0]?.email ?? null
  } catch (error) {
    console.error('[access] проверка ключа доступа не удалась:', error)
    return null
  }
}
