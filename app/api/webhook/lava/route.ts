/**
 * Вебхук Lava.top: POST /api/webhook/lava.
 *
 * Принимается на сайте (Vercel), а не на Render: серверы Lava (Москва,
 * Yandex Cloud) не достукиваются до Render, а холодный старт Render Free
 * (~30 с) превышает 10-секундный таймаут вебхука Lava. Vercel-функция не
 * спит и отвечает за 1-2 с. Кредиты пишутся в тот же Postgres
 * (audit_credits), дедуп по contract_id общий с Render-версией
 * (verify и вебхук не задвоят начисление одной оплаты).
 *
 * Формат payload Lava: payment.* — плоский camelCase (eventType, contractId,
 * buyer), refund.success / chargeback.initiated — конверт snake_case
 * (event_id, event_type, data{}). Обе формы разбираются.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import { ensureCreditTables, normalizeCreditEmail } from '@/lib/audit-credits'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PLAN_SLOTS: Record<string, number> = { full: 1, choice: 3, business: 10 }
const SUCCESS_EVENTS = new Set(['payment.success'])
const REVOKE_EVENTS = new Set(['refund.success', 'chargeback.initiated'])

// productId / offerId тарифов в кабинете Lava
const PRODUCT_PLANS: Record<string, string> = {
  'e262a88a-aabe-4a5b-8cf8-d0774e25f98a': 'full',
  '46156488-439c-4f84-86b9-7628f5a6e93e': 'choice',
  '0ecbb153-f2a5-415b-93e0-03fd0a2b04c6': 'business',
}
const OFFER_PLANS: Record<string, string> = {
  '897a9501-3853-49cd-b22c-1cada7b220ba': 'full',
  '5cf765a3-e5b3-4d79-8f4c-2f603aebf703': 'choice',
  '98783786-61c8-4f37-aa28-ffc1a4477c94': 'business',
}

type Json = Record<string, unknown>

function asObject(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
}

/** Значение по пути «a.b.c» из вложенных объектов. */
function pick(payload: Json, path: string): unknown {
  let current: unknown = payload
  for (const part of path.split('.')) {
    const obj = asObject(current)
    if (!(part in obj)) return null
    current = obj[part]
  }
  return current ?? null
}

function pickAny(payload: Json, paths: string[]): unknown {
  for (const path of paths) {
    const value = pick(payload, path)
    if (value !== null && value !== '') return value
  }
  return null
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') {
    for (const key of ['email', 'id', 'uuid', 'value', 'name']) {
      const nested = asText((value as Json)[key])
      if (nested) return nested
    }
    return null
  }
  return String(value).trim()
}

function csvIds(name: string): Set<string> {
  const raw = process.env[name] ?? ''
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

function resolvePlan(payload: Json, data: Json): string | null {
  const offerId = asText(
    pickAny(payload, ['offerId', 'offer_id', 'offer.id', 'product.offerId', 'product.tierId', 'product.tier_id']) ??
      pickAny(data, ['offerId', 'offer_id', 'tier_id', 'product.tier_id', 'product.tierId']),
  )
  const productId = asText(
    pickAny(payload, ['productId', 'product_id', 'product.id', 'product.productId', 'product.product_id']) ??
      pickAny(data, ['productId', 'product_id', 'product.id', 'product.product_id']),
  )
  const productName = (
    asText(
      pickAny(payload, ['productName', 'product_name', 'product.name', 'product.productName', 'product.product_name', 'productTitle']) ??
        pickAny(data, ['product_name', 'product.name']),
    ) ?? ''
  ).toLowerCase()

  if (offerId) {
    const key = offerId.toLowerCase()
    if (OFFER_PLANS[key]) return OFFER_PLANS[key]
    if (csvIds('LAVA_OFFER_FULL').has(key)) return 'full'
    if (csvIds('LAVA_OFFER_CHOICE').has(key)) return 'choice'
    if (csvIds('LAVA_OFFER_BUSINESS').has(key)) return 'business'
  }
  if (productId) {
    const key = productId.toLowerCase()
    if (PRODUCT_PLANS[key]) return PRODUCT_PLANS[key]
    if (csvIds('LAVA_PRODUCT_FULL').has(key)) return 'full'
    if (csvIds('LAVA_PRODUCT_CHOICE').has(key)) return 'choice'
    if (csvIds('LAVA_PRODUCT_BUSINESS').has(key)) return 'business'
  }
  if (productName.includes('профи') || productName.includes('бизнес')) return 'business'
  if (productName.includes('выбор') && productName.includes('застройщик')) return 'choice'
  if (['полный', 'full', 'pro', 'deep'].some((token) => productName.includes(token))) return 'full'
  if (productName.includes('экспресс') || productName.includes('express')) return 'express'
  return null
}

interface LavaEvent {
  eventId: string
  eventType: string
  contractId: string | null
  email: string | null
  plan: string | null
  amount: string | null
  currency: string | null
  productId: string | null
  offerId: string | null
}

function parseEvent(payload: Json): LavaEvent {
  const data = asObject(payload.data)
  const buyer = asText(pickAny(payload, ['buyer', 'buyerEmail', 'buyer_email', 'email', 'customer.email']) ?? pickAny(data, ['customer_email', 'email']))
  const email = buyer ? normalizeCreditEmail(buyer) : null

  const amountRaw = pickAny(payload, ['amount', 'totalPrice', 'total_price', 'price']) ?? pickAny(data, ['amount'])
  let amount: string | null
  let currency = asText(pickAny(payload, ['currency']) ?? pickAny(data, ['currency']))
  if (amountRaw && typeof amountRaw === 'object') {
    const wrapped = asObject(amountRaw)
    currency = currency ?? asText(wrapped.currency)
    amount = asText(wrapped.amount ?? wrapped.value)
  } else {
    amount = asText(amountRaw)
  }

  return {
    eventId: asText(pickAny(payload, ['eventId', 'event_id', 'id'])) ?? crypto.randomUUID(),
    eventType: (asText(pickAny(payload, ['eventType', 'event_type', 'type'])) ?? '').toLowerCase(),
    contractId: asText(pickAny(payload, ['contractId', 'contract_id', 'invoiceId', 'invoice_id']) ?? pickAny(data, ['contract_id', 'invoice_id'])),
    email,
    plan: resolvePlan(payload, data),
    amount,
    currency,
    productId: asText(pickAny(payload, ['productId', 'product.id', 'product.productId']) ?? pickAny(data, ['product.product_id'])),
    offerId: asText(pickAny(payload, ['offerId', 'offer_id']) ?? pickAny(data, ['offer_id'])),
  }
}

function webhookSecret(): string | null {
  const value = process.env.LAVA_WEBHOOK_SECRET?.trim()
  return value ? value : null
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf-8')
  const right = Buffer.from(b, 'utf-8')
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Канонический JSON с отсортированными ключами — как в Render-версии. */
function sortedStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Json)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${sortedStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null) ?? 'null'
}

function authorized(req: Request, rawBody: string, secretValue: string): boolean {
  const headerKey = req.headers.get('x-api-key') ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  const apiKey = headerKey || (authHeader.startsWith('ApiKey ') ? authHeader.slice('ApiKey '.length) : '')
  if (apiKey && secretsEqual(apiKey, secretValue)) return true
  const signature = req.headers.get('signature') ?? req.headers.get('x-signature') ?? req.headers.get('x-lava-signature') ?? ''
  if (signature) {
    let canonical = rawBody
    try {
      canonical = sortedStringify(JSON.parse(rawBody || '{}'))
    } catch {}
    const digest = createHmac('sha256', secretValue).update(canonical, 'utf-8').digest('hex')
    if (secretsEqual(digest, signature.trim().toLowerCase())) return true
  }
  return false
}

async function ensurePaymentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE,
      contract_id TEXT,
      email TEXT,
      plan TEXT,
      amount TEXT,
      currency TEXT,
      event_type TEXT,
      status TEXT,
      product_id TEXT,
      offer_id TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

type PaymentStatus = 'paid' | 'failed' | 'revoked'

/**
 * Записывает событие в payments (дедуп по event_id) и, если событие новое,
 * начисляет/списывает кредиты. Возвращает true, если запись новая.
 * Дедуп по contract_id страхует от задвоения с Render-каналом
 * (verify и вебхук несут один и тот же id инвойса).
 */
async function recordAndGrant(event: LavaEvent, status: PaymentStatus, payload: Json): Promise<boolean> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO payments (
      id, event_id, contract_id, email, plan, amount, currency,
      event_type, status, product_id, offer_id, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id`,
    [
      crypto.randomUUID(),
      event.eventId,
      event.contractId,
      event.email,
      event.plan,
      event.amount,
      event.currency,
      event.eventType,
      status,
      event.productId,
      event.offerId,
      JSON.stringify(payload),
    ],
  )
  const isNew = (inserted.rowCount ?? 0) > 0
  if (!isNew) return false

  if (status === 'paid') {
    const slots = event.plan ? PLAN_SLOTS[event.plan] : undefined
    if (event.email && slots) {
      if (event.contractId) {
        const existing = await pool.query('SELECT 1 FROM audit_credits WHERE contract_id = $1 LIMIT 1', [event.contractId])
        if ((existing.rowCount ?? 0) > 0) {
          console.log('[lava-webhook] кредит по contract_id=%s уже начислен', event.contractId)
          return isNew
        }
      }
      await pool.query(
        `INSERT INTO audit_credits (id, email, payment_event_id, contract_id, plan, granted, remaining)
         VALUES ($1,$2,$3,$4,$5,$6,$6)
         ON CONFLICT (payment_event_id) DO NOTHING`,
        [crypto.randomUUID(), event.email, event.eventId, event.contractId, event.plan, slots],
      )
    }
    if (event.email && event.plan && PLAN_SLOTS[event.plan]) {
      try {
        await pool.query('UPDATE projects SET paid = TRUE WHERE lower(email) = $1', [event.email])
      } catch (error) {
        console.warn('[lava-webhook] projects.paid не обновлён для %s: %s', event.email, error)
      }
    }
  } else if (status === 'revoked' && event.email) {
    if (event.contractId) {
      await pool.query('UPDATE audit_credits SET remaining = 0 WHERE email = $1 AND contract_id = $2', [
        event.email,
        event.contractId,
      ])
    } else {
      await pool.query(
        `UPDATE audit_credits SET remaining = 0
         WHERE id = (
           SELECT id FROM audit_credits
           WHERE email = $1 AND remaining > 0
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [event.email],
      )
    }
  }
  return isNew
}

export async function GET() {
  return Response.json({ ok: true, service: 'stroyaudit-ai.com lava webhook' })
}

export async function POST(req: Request) {
  const secretValue = webhookSecret()
  if (!secretValue) {
    console.error('[lava-webhook] LAVA_WEBHOOK_SECRET не задан в env Vercel')
    return Response.json({ error: 'LAVA_WEBHOOK_SECRET не задан.' }, { status: 500 })
  }
  const rawBody = await req.text()
  if (!authorized(req, rawBody, secretValue)) {
    return Response.json({ error: 'Неверный секретный ключ.' }, { status: 401 })
  }

  let payload: Json
  try {
    payload = asObject(JSON.parse(rawBody || '{}'))
  } catch {
    return Response.json({ error: 'Некорректный JSON.' }, { status: 400 })
  }

  const event = parseEvent(payload)
  let status: PaymentStatus | null = null
  if (SUCCESS_EVENTS.has(event.eventType)) status = 'paid'
  else if (REVOKE_EVENTS.has(event.eventType)) status = 'revoked'
  else if (event.eventType === 'payment.failed') status = 'failed'
  if (!status) {
    console.log('[lava-webhook] пропущено событие: %s', event.eventType || 'unknown')
    return Response.json({ ok: true, ignored: true, event_type: event.eventType || null })
  }

  if (status === 'paid' && !event.plan) {
    console.warn('[lava-webhook] оплата без известного тарифа: product=%s offer=%s', event.productId, event.offerId)
  }

  try {
    await ensureCreditTables()
    await ensurePaymentsTable()
    const created = await recordAndGrant(event, status, payload)
    console.log(
      '[lava-webhook] %s plan=%s email=%s contract=%s duplicate=%s',
      event.eventType,
      event.plan,
      event.email,
      event.contractId,
      !created,
    )
    return Response.json({
      ok: true,
      duplicate: !created,
      status,
      plan: event.plan,
      email: event.email,
      contract_id: event.contractId,
    })
  } catch (error) {
    console.error('[lava-webhook] обработка не удалась:', error)
    return Response.json({ error: 'Внутренняя ошибка.' }, { status: 500 })
  }
}
