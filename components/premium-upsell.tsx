'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Lock, MessagesSquare, Sparkles, X } from 'lucide-react'
import { ExampleReportLink } from '@/components/example-report-link'
import { useRubRates } from '@/components/fx-rates'
import { getJurisdiction, type Jurisdiction } from '@/components/jurisdiction-provider'
import { isPaidTier, loadSelectedTier, saveSelectedTier, TIER_EVENT, TIER_FRAME_COLOR, type PaidTier } from '@/lib/audit-tier'
import {
  claimReportGeneration,
  lavaWidgetEnvName,
  lavaWidgetId,
  lavaWidgetSrc,
  PAYMENT_CHANNEL,
  PAYMENT_SIGNAL_KEY,
  paymentSuccessFromMessage,
  paymentSuccessFromStorage,
  publishPaymentSuccess,
  releaseReportGeneration,
} from '@/lib/lava-widget'
import { currencyFont, formatGrouped, referenceAmounts, TARIFF_RUB } from '@/lib/fx'
import { LEGAL_EMAIL, LEGAL_MAILTO } from '@/lib/legal'
import { cn } from '@/lib/utils'
import { isRealPdfUrl, showReportInWindow } from '@/lib/report-pdf'

type DeepResult = {
  pdfUrl: string | null
  report: string | null
  chatUrl?: string | null
  emailSent?: boolean
  activeDays?: number
}

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

function remarksWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'замечание'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'замечания'
  return 'замечаний'
}

function criticalWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  return mod10 === 1 && mod100 !== 11 ? 'критическое' : 'критических'
}

const PRO_FEATURES = [
  'Дефектная ведомость для пересмотра сметы и правок в проекте',
  'Все замечания со ссылками на пункты норм, а не только первые',
  'Многостраничный PDF для обоснованного пересмотра сметы и правок в проекте',
  'Способы исправления по каждому замечанию',
  'Чат по отчёту 14 дней',
]

function tariffName(tier: PaidTier) {
  if (tier === 'choice') return 'Выбор застройщика'
  if (tier === 'business') return 'Профи / Бизнес'
  return 'Полный аудит'
}

function tariffPeriod(tier: PaidTier) {
  if (tier === 'choice') return '3 проекта, разовая оплата'
  if (tier === 'business') return '10 проектов, разовая оплата'
  return 'один проект, разовая оплата'
}

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

const PAY_BUTTON_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/85'

function TierPayButton({
  tier,
  label,
  onPay,
}: {
  tier: PaidTier
  label: string
  onPay: () => void
}) {
  const name = tariffName(tier)
  return (
    <div
      className="inline-flex h-11 w-full items-center justify-center gap-1 rounded-lg border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-background/90"
      style={{ borderColor: TIER_FRAME_COLOR[tier] }}
      aria-label={label}
    >
      <button type="button" onClick={onPay} className="inline-flex items-center gap-2 text-left">
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        {formatGrouped(TARIFF_RUB[tier])} <span className={currencyFont}>₽</span>
      </button>
      <a href="#pricing" className="underline decoration-1 underline-offset-2 hover:opacity-70">
        {name}
      </a>
    </div>
  )
}

export function PremiumUpsell({
  request,
  deepUrl,
  consentVersion,
  hiddenCount,
  hiddenCritical,
  initialDeep,
  onFullReport,
}: {
  request: DeepAuditRequest
  deepUrl: string
  consentVersion: string
  hiddenCount: number
  hiddenCritical: number
  initialDeep: DeepResult | null
  onFullReport: (deep: DeepResult) => void
}) {
  const [open, setOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [tier, setTier] = useState<PaidTier>('full')
  const [state, setState] = useState<DeepState>(
    initialDeep ? { kind: 'done', ...initialDeep } : { kind: 'idle' },
  )
  const amountRub = TARIFF_RUB[tier]
  const rates = useRubRates()
  const reference = rates ? referenceAmounts(amountRub, rates) : null
  const features = PRO_FEATURES
  const widgetId = lavaWidgetId(tier)
  const generating = useRef(false)
  const delivered = useRef(Boolean(initialDeep))
  const requestRef = useRef(request)
  requestRef.current = request
  const onFullReportRef = useRef(onFullReport)
  onFullReportRef.current = onFullReport

  const generateFullReport = useCallback(async () => {
    if (generating.current || delivered.current) return
    if (!claimReportGeneration()) return
    const current = requestRef.current
    if (!current.file) {
      releaseReportGeneration()
      setState({
        kind: 'error',
        message: 'Файл проекта не сохранился в браузере. Загрузите его заново — после оплаты отчёт запустится сам.',
      })
      setOpen(true)
      return
    }
    generating.current = true
    setPayOpen(false)
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
    body.append('tier', 'full')
    try {
      const res = await fetch(deepUrl, { method: 'POST', body })
      const raw = await res.text()
      let data: unknown = raw
      try {
        data = JSON.parse(raw)
      } catch {}
      if (!res.ok) {
        generating.current = false
        releaseReportGeneration()
        const detail = pickString(data, ['detail', 'message', 'error'])
        setState({ kind: 'error', message: detail ?? `Не удалось сформировать отчёт (HTTP ${res.status}).` })
        return
      }
      const report = typeof data === 'string' ? data : pickString(data, ['report', 'markdown', 'result'])
      const rawPdf = pickString(data, ['pdf_url', 'pdfUrl', 'download_url'])
      const pdfUrl = isRealPdfUrl(rawPdf) ? rawPdf : null
      if (!report && !pdfUrl) {
        generating.current = false
        releaseReportGeneration()
        setState({ kind: 'error', message: 'Сервер не вернул текст отчёта. Попробуйте ещё раз.' })
        return
      }
      let chatUrl: string | null = null
      let emailSent = false
      let activeDays = 14
      if (report) {
        try {
          const sessionRes = await fetch('/api/report/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              report,
              email: current.email,
              jurisdiction: current.jurisdiction,
              tier: 'full',
            }),
          })
          const session = (await sessionRes.json().catch(() => null)) as {
            url?: unknown
            emailSent?: unknown
            days?: unknown
          } | null
          if (sessionRes.ok && typeof session?.url === 'string') {
            chatUrl = session.url
            emailSent = session.emailSent === true
            activeDays = typeof session.days === 'number' ? session.days : 14
          }
        } catch {}
        if (!chatUrl) chatUrl = (await createChatLink(report, current.jurisdiction, current.email)).url
      }
      delivered.current = true
      onFullReportRef.current({ pdfUrl, report, chatUrl })
      setState({ kind: 'done', pdfUrl, report, chatUrl, emailSent, activeDays })
    } catch {
      generating.current = false
      releaseReportGeneration()
      setState({ kind: 'error', message: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.' })
    }
  }, [consentVersion, deepUrl])

  useEffect(() => {
    const syncTier = () => setTier(loadSelectedTier())
    syncTier()
    window.addEventListener(TIER_EVENT, syncTier)
    return () => window.removeEventListener(TIER_EVENT, syncTier)
  }, [])

  const unlockPaidReport = useCallback(
    (paid: PaidTier) => {
      saveSelectedTier(paid)
      setTier(paid)
      setPayOpen(false)
      document.getElementById('audit-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void generateFullReport()
    },
    [generateFullReport],
  )

  useEffect(() => {
    const onPaid = (paid: PaidTier) => unlockPaidReport(paid)
    const onMessage = (event: MessageEvent) => {
      const paid = paymentSuccessFromMessage(event)
      if (!paid) return
      const selected = paid === true ? loadSelectedTier() : paid
      if (event.origin !== window.location.origin) publishPaymentSuccess(selected)
      onPaid(selected)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PAYMENT_SIGNAL_KEY) return
      const paid = paymentSuccessFromStorage(event.newValue)
      if (paid) onPaid(paid)
    }
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(PAYMENT_CHANNEL)
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: unknown; tier?: unknown } | null
        if (data?.type === 'stroyaudit:payment-success' && isPaidTier(data.tier)) onPaid(data.tier)
      }
    } catch {}
    window.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
      channel?.close()
    }
  }, [unlockPaidReport])

  function handleChatCreated(chatUrl: string) {
    if (state.kind !== 'done') return
    const next = {
      pdfUrl: state.pdfUrl,
      report: state.report,
      chatUrl,
      emailSent: state.emailSent,
      activeDays: state.activeDays,
    }
    onFullReport(next)
    setState({ kind: 'done', ...next })
  }

  function openPayment(paid: PaidTier) {
    saveSelectedTier(paid)
    setTier(paid)
    setOpen(false)
    setPayOpen(true)
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
            <p className="text-sm font-semibold">Оплата подтверждена. Формируем полный отчёт</p>
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
                {hiddenCount > 0
                  ? `В вашем проекте скрыто ещё ${hiddenCount} ${remarksWord(hiddenCount)}${
                      hiddenCritical > 0
                        ? ` (в том числе ${hiddenCritical} ${criticalWord(hiddenCritical)})`
                        : ''
                    }. Открыть весь список и способы исправления за ${formatGrouped(TARIFF_RUB.full)} ₽.`
                  : `Открыть весь список замечаний и способы исправления за ${formatGrouped(TARIFF_RUB.full)} ₽.`}
              </p>
              <p className="text-xs leading-relaxed text-background/70">
                На выходе — многостраничный PDF с таблицами и пунктами норм ({getJurisdiction(request.jurisdiction).standards}). Это документ для обоснованного пересмотра сметы и правок в проекте.
              </p>
              <p className="text-[11px] leading-relaxed text-background/60">
                Если в полном отчёте не окажется ни одного замечания со ссылкой на СП или СН — вернём деньги по
                письму на{' '}
                <a href={LEGAL_MAILTO} className="underline underline-offset-2">
                  {LEGAL_EMAIL}
                </a>
                .
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <div className="flex flex-col items-stretch gap-1.5">
              <TierPayButton
                tier="full"
                label={`Открыть весь список за ${formatGrouped(TARIFF_RUB.full)} ₽`}
                onPay={() => openPayment('full')}
              />
              <ExampleReportLink tone="onDark">Пример полного отчёта</ExampleReportLink>
            </div>
            <TierPayButton
              tier="choice"
              label={`Оплатить ${formatGrouped(TARIFF_RUB.choice)} ₽ за 3 проекта`}
              onPay={() => openPayment('choice')}
            />
            <TierPayButton
              tier="business"
              label={`Оплатить ${formatGrouped(TARIFF_RUB.business)} ₽ за 10 проектов`}
              onPay={() => openPayment('business')}
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
        amountRub={amountRub}
        reference={reference}
        tier={tier}
        features={features}
        email={request.email}
        jurisdiction={request.jurisdiction}
        state={state}
        onPay={() => openPayment(tier)}
        onRetry={() => void generateFullReport()}
        onChatCreated={handleChatCreated}
      />
      <LavaWidgetDialog
        open={payOpen}
        tier={tier}
        widgetId={widgetId}
        onClose={() => setPayOpen(false)}
      />
    </>
  )
}

function DeepAuditDialog({
  open,
  onClose,
  amountRub,
  reference,
  tier,
  features,
  email,
  jurisdiction,
  state,
  onPay,
  onRetry,
  onChatCreated,
}: {
  open: boolean
  onClose: () => void
  amountRub: number
  reference: { byn: number; kzt: number } | null
  tier: PaidTier
  features: string[]
  email: string
  jurisdiction: Jurisdiction
  state: DeepState
  onPay: () => void
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
              {tariffName(tier)}
            </h2>
            <p className="text-xs text-muted-foreground">{tariffPeriod(tier)}</p>
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
              {state.emailSent
                ? `Ваш отчет готов и отправлен на ваш email. Ссылка на чат активна в течение ${state.activeDays ?? 14} дней.`
                : `Ваш отчет готов. Ссылка на чат активна в течение ${state.activeDays ?? 14} дней. Письмо на ${email} не отправилось — откройте чат по ссылке ниже.`}
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
              Оплата подтверждена. Формируем полный отчёт — это
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

            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">К оплате</span>
                <span className="font-mono text-xl font-bold tabular-nums">
                  {formatGrouped(amountRub)} <span className={currencyFont}>₽</span>
                </span>
              </div>
              {reference && (
                <p className="text-right text-xs tabular-nums text-muted-foreground">
                  ≈ {formatGrouped(reference.byn)} BYN / {formatGrouped(reference.kzt)} <span className={currencyFont}>₸</span>
                </p>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Списание происходит в российских рублях (RUB) по курсу банка-эмитента.
              </p>
            </div>

            {state.kind === 'error' && (
              <p role="alert" className="text-xs text-warning">
                {state.message}
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
          {state.kind !== 'done' && state.kind !== 'submitting' && (
            <div className="flex flex-col gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={onPay}
                className={cn(PAY_BUTTON_CLASS, 'border')}
                style={{ borderColor: TIER_FRAME_COLOR[tier] }}
              >
                Оплатить {formatGrouped(amountRub)} <span className={currencyFont}>₽</span>
              </button>
              {tier === 'full' && (
                <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground sm:text-right">
                  Если в полном отчёте не окажется ни одного замечания со ссылкой на СП или СН — вернём деньги по
                  письму на {LEGAL_EMAIL}.
                </p>
              )}
            </div>
          )}
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

function LavaWidgetDialog({
  open,
  tier,
  widgetId,
  onClose,
}: {
  open: boolean
  tier: PaidTier
  widgetId: string | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[540px] rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      style={{ borderColor: TIER_FRAME_COLOR[tier] }}
    >
      <div className="flex flex-col gap-4 p-5 text-left sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-base font-bold">
              Оплата: {tariffName(tier)}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              После оплаты подробный отчёт откроется здесь же.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {widgetId ? (
          <div className="flex justify-center">
            <iframe
              title="lava.top"
              src={lavaWidgetSrc(widgetId)}
              width={300}
              height={50}
              referrerPolicy="origin"
              className="block max-w-full border-0"
              style={{ border: 'none' }}
            />
          </div>
        ) : (
          <p role="alert" className="text-sm text-warning">
            Для этого тарифа нужен свой Web-Widget. В кабинете Lava.top сгенерируйте код и вставьте его UUID в
            переменную {lavaWidgetEnvName(tier)}.
          </p>
        )}
      </div>
    </dialog>
  )
}
