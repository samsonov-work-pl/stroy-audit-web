import { randomUUID } from 'node:crypto'
import { and, eq, gt, lt, sql } from 'drizzle-orm'

import { db, pool } from '@/lib/db'
import { sessions } from '@/lib/db/schema'
import {
  isSessionTier,
  MAX_CHAT_MESSAGES,
  sessionDays,
  type ChatTurn,
  type SessionTier,
} from '@/lib/report-limits'

export { isSessionTier, MAX_CHAT_MESSAGES, sessionDays }
export type { ChatTurn, SessionTier }

let tableReady: Promise<void> | null = null

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

function ensureSessionsTable() {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          report_content TEXT NOT NULL,
          chat_history JSONB NOT NULL DEFAULT '[]'::jsonb,
          message_count INTEGER NOT NULL DEFAULT 0,
          tier TEXT NOT NULL,
          jurisdiction TEXT,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        tableReady = null
        throw error
      })
  }
  return tableReady
}

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function createReportSession(input: {
  email: string
  report: string
  tier: SessionTier
  jurisdiction: string | null
}) {
  if (!databaseConfigured()) throw new Error('DATABASE_URL не задан')
  await ensureSessionsTable()
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  const token = randomUUID()
  const days = sessionDays(input.tier)
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({
    token,
    email: input.email,
    reportContent: input.report,
    chatHistory: [],
    messageCount: 0,
    tier: input.tier,
    jurisdiction: input.jurisdiction,
    expiresAt,
  })
  return { token, days, expiresAt }
}

export async function findActiveSession(token: string) {
  if (!databaseConfigured() || !TOKEN_PATTERN.test(token)) return null
  try {
    await ensureSessionsTable()
    const [row] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
    if (!row) return null
    if (row.expiresAt.getTime() <= Date.now()) {
      await db.delete(sessions).where(eq(sessions.token, token))
      return null
    }
    return row
  } catch (error) {
    console.error('[session] lookup failed:', error)
    return null
  }
}

/** Reserves one user question. Returns the row after increment, or null when the link is dead or the limit is spent. */
export async function reserveSessionMessage(token: string) {
  if (!databaseConfigured()) return null
  await ensureSessionsTable()
  const rows = await db
    .update(sessions)
    .set({ messageCount: sql`${sessions.messageCount} + 1` })
    .where(
      and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), lt(sessions.messageCount, MAX_CHAT_MESSAGES)),
    )
    .returning()
  return rows[0] ?? null
}

export async function releaseSessionMessage(token: string) {
  await db
    .update(sessions)
    .set({ messageCount: sql`GREATEST(${sessions.messageCount} - 1, 0)` })
    .where(eq(sessions.token, token))
}

export async function appendSessionTurns(token: string, turns: ChatTurn[]) {
  if (turns.length === 0) return
  await db
    .update(sessions)
    .set({
      chatHistory: sql`coalesce(${sessions.chatHistory}, '[]'::jsonb) || ${JSON.stringify(turns)}::jsonb`,
    })
    .where(eq(sessions.token, token))
}

export function readChatHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  const turns: ChatTurn[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as { role?: unknown; content?: unknown }
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') continue
    turns.push({ role: record.role, content: record.content })
  }
  return turns
}
