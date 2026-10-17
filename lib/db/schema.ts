import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  email: text('email'),
  jurisdiction: text('jurisdiction').notNull(),
  report: text('report').notNull(),
  paid: boolean('paid').notNull().default(false),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  contractId: text('contract_id'),
  email: text('email'),
  plan: text('plan'),
  amount: text('amount'),
  currency: text('currency'),
  eventType: text('event_type'),
  status: text('status').notNull(),
  productId: text('product_id'),
  offerId: text('offer_id'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  role: text('role').notNull(),
  parts: jsonb('parts').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
