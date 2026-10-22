import { randomBytes, randomUUID } from 'node:crypto'
import { and, asc, eq, lt, sql } from 'drizzle-orm'
import type { UIMessage } from 'ai'

import { db } from '@/lib/db'
import { chatMessages, projects } from '@/lib/db/schema'

export const MAX_USER_MESSAGES = 60
export const MAX_REPORT_CHARS = 200_000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/

/** Outside production, or with CHAT_TEST_MODE, a project is treated as paid without a Lava.top widget. */
export function isChatTestMode() {
  const flag = (process.env.CHAT_TEST_MODE ?? '').trim().toLowerCase()
  return process.env.NODE_ENV !== 'production' || flag === 'true' || flag === '1'
}

export async function createProject(input: { report: string; jurisdiction: string; email: string | null; paid: boolean }) {
  const token = randomBytes(32).toString('base64url')
  await db.insert(projects).values({
    id: randomUUID(),
    token,
    email: input.email,
    jurisdiction: input.jurisdiction,
    report: input.report,
    paid: input.paid,
  })
  return token
}

export async function findPaidProject(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.token, token), eq(projects.paid, true)))
    .limit(1)
  return project ?? null
}

/** Atomically reserves one user message; returns false once the project has hit its limit. */
export async function reserveMessage(projectId: string) {
  const rows = await db
    .update(projects)
    .set({ messageCount: sql`${projects.messageCount} + 1` })
    .where(and(eq(projects.id, projectId), lt(projects.messageCount, MAX_USER_MESSAGES)))
    .returning({ messageCount: projects.messageCount })
  return rows.length > 0
}

export async function loadMessages(projectId: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(asc(chatMessages.createdAt))
  return rows.map((row) => ({
    id: row.id,
    role: row.role as UIMessage['role'],
    parts: row.parts as UIMessage['parts'],
  }))
}

export async function saveMessages(projectId: string, messages: UIMessage[]) {
  if (messages.length === 0) return
  const base = Date.now()
  await db
    .insert(chatMessages)
    .values(
      messages.map((message, index) => ({
        id: message.id || randomUUID(),
        projectId,
        role: message.role,
        parts: message.parts,
        createdAt: new Date(base + index),
      })),
    )
    .onConflictDoNothing()
}
