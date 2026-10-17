import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { payments } from '@/lib/db/schema'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase() ?? ''
  if (!value || value.length > 254 || !EMAIL_PATTERN.test(value)) return null
  return value
}

/** A confirmed Lava.top payment for this email unlocks the full report. Express is free and does not count. */
export async function emailHasPaidFullAudit(email: string | null | undefined) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  try {
    const rows = await db
      .select({ status: payments.status, plan: payments.plan })
      .from(payments)
      .where(eq(payments.email, normalized))
      .orderBy(desc(payments.createdAt))
      .limit(20)
    if (rows[0]?.status === 'revoked') return false
    return rows.some((row) => row.status === 'paid' && row.plan !== 'express')
  } catch {
    return false
  }
}
