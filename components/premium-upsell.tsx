'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Lock, MessagesSquare, Sparkles, X } from 'lucide-react'
import { getJurisdiction, type Jurisdiction } from '@/components/jurisdiction-provider'
import { loadSelectedTier, paymentSuccessUrl, saveSelectedTier, TIER_EVENT, TIER_FRAME_COLOR, type PaidTier } from '@/lib/audit-tier'
import { cn } from '@/lib/utils'
import { isRealPdfUrl, showReportInWindow } from '@/lib/report-pdf'

type DeepResult = { pdfUrl: string | null; report: string | null; chatUrl?: string | null }

const CHAT_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || ''
const CHAT_SESSION_KEY = 'stroyaudit-chat:'

function chatErrorMessage(data: unknown, status: number) {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    for (const key of ['error', 'message', 'detail']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value
    }
  }
  if (status === 404) return 'Сервер не принимает сессию чата.'
  return `Не удалось открыть чат (HTTP ${status}).`
}

function chatSessionUrl(data: unknown, endpoint: string) {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const apiOrigin = endpoint.startsWith('/') ? window.location.origin : new URL(endpoint).origin
  for (const key of ['url', 'chat_url', 'chatUrl', 'session_url']) {
    const value = record[key]
    if (typeof value !== 'string' || !value.trim()) continue
    if (/^https?:\/\//i.test(value)) return value
    if (value.startsWith('/')) return `${apiOrigin}${value}`
  }
  const token = record.token ?? record.session_id ?? record.sessionId
  if (typeof token !== 'string' || !token.trim()) return null
  return `${window.location.origin}/chat/${encodeURIComponent(token.trim())}`
}

function rememberChatSession(url: string, report: string, jurisdiction: Jurisdiction, email: string) {
  try {
    const parsed = new URL(url)
    if (parsed.origin !== window.location.origin) return
    const token = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) ?? '')
    if (!token) return
    localStorage.setItem(CHAT_SESSION_KEY + token, JSON.stringify({ report, jurisdiction, email }))
  } catch {}
}

async function requestChatSession(endpoint: string, report: string, jurisdiction: Jurisdiction, email: string) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report, jurisdiction, email }),
    signal: endpoint.startsWith('/') ? undefined : AbortSignal.timeout(12_000),
  })
  const data: unknown = await res.json().catch(() => ({}))
  const url = chatSessionUrl(data, endpoint)
  if (!res.ok || !url) return { url: null, error: chatErrorMessage(data, res.status), missing: res.status === 404 || res.status === 405 }
  rememberChatSession(url, report, jurisdiction, email)
  return { url, error: null, missing: false }
}

async function createChatLink(report: string, jurisdiction: Jurisdiction, email: string) {
  const endpoints = CHAT_API_URL ? [`${CHAT_API_URL}/api/chat/session`, '/api/chat/session'] : ['/api/chat/session']
  let lastError = 'Не удалось связаться с сервером чата.'
  for (const endpoint of endpoints) {
    try {
      const result = await requestChatSession(endpoint, report, jurisdiction, email)
      if (result.url) return { url: result.url, error: null }
      lastError = result.error ?? lastError
      if (!result.missing) break
    } catch {
      lastError = 'Не удалось связаться с сервером чата.'
    }
  }
  return { url: null, error: lastError }
}

const CHAT_BUTTON_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60'

function ChatLink({
  href,
  report,
  jurisdiction,
  email,
  onCreated,
}: {
  href?: string | null
  report: string | null
  jurisdiction: Jurisdiction
  email: string
  onCreated: (chatUrl: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener" className={CHAT_BUTTON_CLASS}>
        <MessagesSquare className="size-4" aria-hidden="true" />
        Обсудить проект в чате
      </a>
    )
  }
  if (!report) return null

  async function createAndOpen() {
    if (!report) return
    const chatWindow = window.open('', '_blank')
    setPending(true)
    setFailed(null)
    const { url, error } = await createChatLink(report, jurisdiction, email)
    setPending(false)
    if (!url) {
      chatWindow?.close()
      setFailed(error ?? 'Не удалось открыть чат. Попробуйте ещё раз немного позже.')
      return
    }
    onCreated(url)
    if (chatWindow && !chatWindow.closed) chatWindow.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={createAndOpen} disabled={pending} className={CHAT_BUTTON_CLASS}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <MessagesSquare className="size-4" aria-hidden="true" />
        )}
        Обсудить проект в чате
      </button>
      {failed ? (
        <p className="text-xs text-destructive" role="alert">
          {failed}
        </p>
      ) : null}
    </div>
  )
}

function OpenReportButton({
  pdfUrl,
  report,
  chatUrl,
  jurisdiction,
  label,
}: DeepResult & { jurisdiction: Jurisdiction; label: string }) {
  const className =
    'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85'
  if (pdfUrl) {
    return (
      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={className}>
        <ExternalLink className="size-4" aria-hidden="true" />
        {label}
      </a>
    )
  }
  if (!report) return null
  return (
    <button
      type="button"
      className={className}
      onClick={() => showReportInWindow(null, { markdown: report, standards: getJurisdiction(jurisdiction).standards, chatUrl })}
    >
      <ExternalLink className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

const DEEP_PRICE: Record<Jurisdiction, string> = {
  russia: '7 900 ₽',
  belarus: '249 BYN',
  kazakhstan: '39 900 ₸',
  eurocodes: '7 900 ₽',
}

const DEVELOPER_PRICE: Record<Jurisdiction, string> = {
  russia: '29 900 ₽',
  belarus: '899 BYN',
  kazakhstan: '149 900 ₸',
  eurocodes: '29 900 ₽',
}

const PRO_FEATURES = [
  'Все найденные замечания, а не только топ-3',
  'Ссылки на конкретные пункты норм',
  'Рекомендации по исправлению',
  'Отчёт в PDF для подрядчика и экспертизы',
  'Чат по вашему отчёту: разбор замечаний и приоритетов по проекту',
]

const DEVELOPER_FEATURES = [
  ...PRO_FEATURES,
  'Детальный анализ смет и ведомостей объёмов',
  'Разбор спецификаций материалов',
  'Строительные рекомендации для подрядчиков',
]

export type DeepAuditRequest = {
  file: File | null
  email: string
  jurisdiction: Jurisdiction
  auditId: string | null
}

type DeepState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | ({ kind: 'done' } & DeepResult)

function pickString(data: unknown, keys: string[]) {
  if (!data || typeof data !== 'object') return null
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key]
    if (typeof value === 'string' && value) return value
  }
  return null
}

function paymentJustSucceeded() {
  const params = new URLSearchParams(window.location.search)
  return params.get('payment') === 'success' || params.get('status') === 'success'
}

function clearPaymentSuccess() {
  loadSelectedTier()
  const url = new URL(window.location.href)
  url.searchParams.delete('payment')
  if (url.searchParams.get('status') === 'success') url.searchParams.delete('status')
  url.searchParams.delete('invoiceId')
  url.searchParams.delete('tier')
  const query = url.searchParams.toString()
  window.history.replaceState(null, '', url.pathname + (query ? `?${query}` : '') + url.hash)
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function isLavaCheckout(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host === 'lava.top' || host.endsWith('.lava.top')
  } catch {
    return false
  }
}

const LAVA_FULL_CHECKOUT = 'https://app.lava.top/products/46156488-439c-4f84-86b9-7628f5a6e93e'

function configuredCheckout(tier: PaidTier, jurisdiction: Jurisdiction) {
  if (tier === 'developer') {
    const direct =
      process.env.NEXT_PUBLIC_LAVA_CHECKOUT_DEVELOPER?.trim() ||
      process.env.NEXT_PUBLIC_LAVA_DEVELOPER_URL?.trim()
    if (direct && isHttpUrl(direct)) return direct
    const productId = process.env.NEXT_PUBLIC_LAVA_PRODUCT_DEVELOPERS?.trim()
    if (productId) return `https://app.lava.top/products/${encodeURIComponent(productId)}`
    return null
  }

  const byJurisdiction: Record<Jurisdiction, string | undefined> = {
    russia: process.env.NEXT_PUBLIC_LAVA_CHECKOUT_RUB,
    belarus: process.env.NEXT_PUBLIC_LAVA_CHECKOUT_BYN,
    kazakhstan: process.env.NEXT_PUBLIC_LAVA_CHECKOUT_KZT,
    eurocodes: process.env.NEXT_PUBLIC_LAVA_CHECKOUT_EUR,
  }
  const candidates = [
    byJurisdiction[jurisdiction],
    process.env.NEXT_PUBLIC_LAVA_CHECKOUT_URL,
    process.env.NEXT_PUBLIC_LAVA_FULL_URL,
  ]
  for (const candidate of candidates) {
    const url = candidate?.trim()
    if (url && isHttpUrl(url)) return url
  }
  const productId = process.env.NEXT_PUBLIC_LAVA_PRODUCT_FULL?.trim()
  if (productId) return `https://app.lava.top/products/${encodeURIComponent(productId)}`
  return LAVA_FULL_CHECKOUT
}

function withCheckoutParams(url: string, email: string, tier: PaidTier) {
  const target = new URL(url)
  if (email && isLavaCheckout(url)) target.searchParams.set('email', email)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    target.searchParams.set('successful_return_url', paymentSuccessUrl(window.location.origin, tier))
  }
  return target.toString()
}

const PAY_BUTTON_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/85'

function TierPayButton({
  tier,
  label,
  href,
  onPay,
}: {
  tier: PaidTier
  label: string
  href: string | null
  onPay: (event: { preventDefault: () => void }) => void
}) {
  const className =
    'inline-flex h-11 items-center justify-center gap-1 rounded-lg border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-background/90'
  const style = { borderColor: TIER_FRAME_COLOR[tier] }
  const tariffName = tier === 'full' ? 'полный отчёт' : 'отчёт для застройщиков'
  const payClass = 'inline-flex items-center gap-2'
  const tariffLink = (
    <a href="#pricing" className="underline decoration-1 underline-offset-2 hover:opacity-70">
      {tariffName}
    </a>
  )
  if (href) {
    return (
      <div className={className} style={style} aria-label={label}>
        <a href={href} onClick={onPay} className={payClass}>
          <Sparkles className="size-4" aria-hidden="true" />
          Получить
        </a>
        {tariffLink}
      </div>
    )
  }
  return (
    <div className={className} style={style} aria-label={label}>
      <button type="button" onClick={() => onPay({ preventDefault() {} })} className={payClass}>
        <Sparkles className="size-4" aria-hidden="true" />
        Получить
      </button>
      {tariffLink}
    </div>
  )
}

export function PremiumUpsell({
  request,
  deepUrl,
  consentVersion,
  hiddenCount,
  initialDeep,
  onFullReport,
}: {
  request: DeepAuditRequest
  deepUrl: string
  consentVersion: string
  hiddenCount: number
  initialDeep: DeepResult | null
  onFullReport: (deep: DeepResult) => void
}) {
  const [open, setOpen] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [tier, setTier] = useState<PaidTier>('full')
  const [state, setState] = useState<DeepState>(
    initialDeep ? { kind: 'done', ...initialDeep } : { kind: 'idle' },
  )
  const price = (tier === 'developer' ? DEVELOPER_PRICE : DEEP_PRICE)[request.jurisdiction]
  const features = tier === 'developer' ? DEVELOPER_FEATURES : PRO_FEATURES
  const hrefFor = (paid: PaidTier) => {
    const url = configuredCheckout(paid, request.jurisdiction)
    return url ? withCheckoutParams(url, request.email, paid) : null
  }
  const checkoutHref = hrefFor(tier)
  const generating = useRef(false)
  const delivered = useRef(Boolean(initialDeep))
  const requestRef = useRef(request)
  requestRef.current = request
  const onFullReportRef = useRef(onFullReport)
  onFullReportRef.current = onFullReport

  const generateFullReport = useCallback(async () => {
    if (generating.current || delivered.current) return
    const current = requestRef.current
    if (!current.file) {
      setState({
        kind: 'error',
        message: 'Файл проекта не сохранился в браузере. Загрузите его заново — после оплаты отчёт запустится сам.',
      })
      return
    }
    generating.current = true
    setState({ kind: 'submitting' })
    setOpen(true)
    const body = new FormData()
    body.append('file', current.file)
    body.append('email', current.email)
    body.append('jurisdiction', current.jurisdiction)
    body.append('consent_accepted', 'true')
    body.append('consent_version', consentVersion)
    body.append('payment_verified', 'true')
    if (current.auditId) body.append('audit_id', current.auditId)
    body.append('tier', loadSelectedTier())
    try {
      const res = await fetch(deepUrl, { method: 'POST', body })
      const raw = await res.text()
      let data: unknown = raw
      try {
        data = JSON.parse(raw)
      } catch {}
      if (!res.ok) {
        generating.current = false
        const detail = pickString(data, ['detail', 'message', 'error'])
        setState({ kind: 'error', message: detail ?? `Не удалось сформировать отчёт (HTTP ${res.status}).` })
        return
      }
      const report = typeof data === 'string' ? data : pickString(data, ['report', 'markdown', 'result'])
      const rawPdf = pickString(data, ['pdf_url', 'pdfUrl', 'download_url'])
      const pdfUrl = isRealPdfUrl(rawPdf) ? rawPdf : null
      if (!report && !pdfUrl) {
        generating.current = false
        setState({ kind: 'error', message: 'Сервер не вернул текст отчёта. Попробуйте ещё раз.' })
        return
      }
      const chatUrl = report ? (await createChatLink(report, current.jurisdiction, current.email)).url : null
      delivered.current = true
      onFullReportRef.current({ pdfUrl, report, chatUrl })
      setState({ kind: 'done', pdfUrl, report, chatUrl })
    } catch {
      generating.current = false
      setState({ kind: 'error', message: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.' })
    }
  }, [consentVersion, deepUrl])

  useEffect(() => {
    const syncTier = () => setTier(loadSelectedTier())
    syncTier()
    window.addEventListener(TIER_EVENT, syncTier)
    return () => window.removeEventListener(TIER_EVENT, syncTier)
  }, [])

  useEffect(() => {
    if (!paymentJustSucceeded()) return
    if (initialDeep || delivered.current) {
      clearPaymentSuccess()
      return
    }
    if (!request.file) return
    clearPaymentSuccess()
    document.getElementById('audit-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    void generateFullReport()
  }, [initialDeep, request.file, generateFullReport])

  function handleChatCreated(chatUrl: string) {
    if (state.kind !== 'done') return
    const next = { pdfUrl: state.pdfUrl, report: state.report, chatUrl }
    onFullReport(next)
    setState({ kind: 'done', ...next })
  }

  async function startPayment(event: { preventDefault: () => void }, paid: PaidTier = tier) {
    event.preventDefault()
    setPaymentError(null)
    saveSelectedTier(paid)
    setTier(paid)
    const fallback = configuredCheckout(paid, request.jurisdiction)
    const fallbackHref = fallback ? withCheckoutParams(fallback, request.email, paid) : null
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: request.email, jurisdiction: request.jurisdiction, tier: paid }),
      })
      const data = (await res.json().catch(() => ({}))) as { paymentUrl?: string }
      if (data.paymentUrl?.startsWith('https://')) {
        window.location.assign(data.paymentUrl)
        return
      }
    } catch {}
    if (fallbackHref) {
      window.location.assign(fallbackHref)
      return
    }
    setPaymentError('Ссылка на оплату этого тарифа не настроена. Напишите нам — поможем оформить доступ.')
    setOpen(true)
  }

  return (
    <>
      {state.kind === 'done' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
            Подробный аудит готов
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
            <OpenReportButton pdfUrl={state.pdfUrl} report={state.report} chatUrl={state.chatUrl} jurisdiction={request.jurisdiction} label="Открыть отчёт (PDF)" />
            <ChatLink
              href={state.chatUrl}
              report={state.report}
              jurisdiction={request.jurisdiction}
              email={request.email}
              onCreated={handleChatCreated}
            />
          </div>
        </div>
      ) : state.kind === 'submitting' ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-5 text-success" role="status">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">
              Оплата подтверждена. Формируем {tier === 'developer' ? 'отчёт для застройщиков' : 'полный отчёт'}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Это может занять несколько минут. Не закрывайте страницу — готовый отчёт появится здесь.
            </p>
          </div>
        </div>
      ) : (
      <div className="relative overflow-hidden rounded-xl border border-foreground/15 bg-foreground p-5 text-background sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-background/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background/10">
              <Lock className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-bold text-balance">
                Получить подробный инженерный аудит и скачать отчёт в PDF
              </p>
              <p className="text-xs leading-relaxed text-background/70">
                {hiddenCount > 0
                  ? `Ещё ${hiddenCount} замечаний скрыто в экспресс-версии.`
                  : 'Полный разбор проекта с рекомендациями и ссылками на нормы.'}{' '}
                {getJurisdiction(request.jurisdiction).standards}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <TierPayButton
              tier="full"
              label="Получить полный отчёт"
              href={hrefFor('full')}
              onPay={(event) => void startPayment(event, 'full')}
            />
            <TierPayButton
              tier="developer"
              label="Получить отчёт для застройщиков"
              href={hrefFor('developer')}
              onPay={(event) => void startPayment(event, 'developer')}
            />
          </div>
        </div>
      </div>
      )}

      <DeepAuditDialog
        open={open}
        onClose={() => {
          if (state.kind !== 'submitting') setOpen(false)
        }}
        price={price}
        tier={tier}
        features={features}
        email={request.email}
        jurisdiction={request.jurisdiction}
        state={state}
        checkoutHref={checkoutHref}
        paymentError={paymentError}
        onPay={startPayment}
        onRetry={() => void generateFullReport()}
        onChatCreated={handleChatCreated}
      />
    </>
  )
}

function DeepAuditDialog({
  open,
  onClose,
  price,
  tier,
  features,
  email,
  jurisdiction,
  state,
  checkoutHref,
  paymentError,
  onPay,
  onRetry,
  onChatCreated,
}: {
  open: boolean
  onClose: () => void
  price: string
  tier: PaidTier
  features: string[]
  email: string
  jurisdiction: Jurisdiction
  state: DeepState
  checkoutHref: string | null
  paymentError: string | null
  onPay: (event: { preventDefault: () => void }) => void
  onRetry: () => void
  onChatCreated: (chatUrl: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const submitting = state.kind === 'submitting'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-5 text-left sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-background">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-base font-bold text-balance">
              {tier === 'developer' ? 'Аудит для застройщиков' : 'Подробный инженерный аудит'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tier === 'developer' ? 'Тариф «Для застройщиков» · в месяц' : 'Тариф «Полный аудит» · разовая оплата'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {state.kind === 'done' ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4" role="status">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              Подробный аудит готов
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Отчёт на этой странице. Его можно открыть отдельно и сохранить в PDF. Отчёт для{' '}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Остались вопросы по замечаниям? Обсудите их в чате по вашему отчёту: ассистент знает ваш отчёт
              и поможет расставить приоритеты исправлений.
            </p>
            <OpenReportButton pdfUrl={state.pdfUrl} report={state.report} chatUrl={state.chatUrl} jurisdiction={jurisdiction} label="Открыть отчёт (PDF)" />
            <ChatLink
              href={state.chatUrl}
              report={state.report}
              jurisdiction={jurisdiction}
              email={email}
              onCreated={onChatCreated}
            />
          </div>
        ) : state.kind === 'submitting' ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-4 text-success" role="status">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-success" aria-hidden="true" />
            <p className="text-sm font-semibold leading-relaxed">
              Оплата подтверждена. Формируем {tier === 'developer' ? 'отчёт для застройщиков' : 'полный отчёт'} — это
              может занять несколько минут.
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between rounded-lg border border-border bg-background px-4 py-3">
              <span className="text-sm text-muted-foreground">К оплате</span>
              <span className="font-mono text-xl font-bold tabular-nums">{price}</span>
            </div>

            {(state.kind === 'error' || paymentError) && (
              <p role="alert" className="text-xs text-warning">
                {state.kind === 'error' ? state.message : paymentError}
              </p>
            )}
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {state.kind === 'done' ? 'Закрыть' : 'Позже'}
          </button>
          {state.kind === 'error' && (
            <button type="button" onClick={onRetry} className={PAY_BUTTON_CLASS}>
              Сформировать отчёт
            </button>
          )}
          {state.kind !== 'done' && state.kind !== 'submitting' &&
            (checkoutHref ? (
              <a
                href={checkoutHref}
                onClick={onPay}
                className={cn(PAY_BUTTON_CLASS, 'border')}
                style={{ borderColor: TIER_FRAME_COLOR[tier] }}
              >
                {`Оплатить ${price}`}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onPay({ preventDefault() {} })}
                className={cn(PAY_BUTTON_CLASS, 'border')}
                style={{ borderColor: TIER_FRAME_COLOR[tier] }}
              >
                {`Оплатить ${price}`}
              </button>
            ))}
          {state.kind === 'submitting' && (
            <button type="button" disabled className="inline-flex h-11 cursor-default items-center justify-center gap-2 rounded-lg bg-success px-4 text-sm font-semibold text-white">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Формируем отчёт…
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
