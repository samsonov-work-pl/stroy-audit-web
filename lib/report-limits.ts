export const MAX_CHAT_MESSAGES = 30
export const ONE_TIME_DAYS = 14
export const SUBSCRIPTION_DAYS = 30

export type SessionTier = 'full' | 'business' | 'developer'
export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export function sessionDays(tier: SessionTier) {
  return tier === 'developer' || tier === 'business' ? SUBSCRIPTION_DAYS : ONE_TIME_DAYS
}

export function isSessionTier(value: unknown): value is SessionTier {
  return value === 'full' || value === 'business' || value === 'developer'
}
