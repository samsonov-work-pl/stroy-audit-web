'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Lock, MessagesSquare, Sparkles, X } from 'lucide-react'
import { getJurisdiction, type Jurisdiction } from '@/components/jurisdiction-provider'
import { isRealPdfUrl, openReportWindow, showReportInWindow } from '@/lib/report-pdf'

type DeepResult = { pdfUrl: string | null; report: string | null; chatUrl?: string | null }

async function createChatLink(report: string, jurisdiction: Jurisdiction, email: string) {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, jurisdiction, email }),
    })
    const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string }
    if (!res.ok || !data.token) return { url: null, error: data.error ?? null }
    return { url: `${window.location.origin}/chat/${data.token}`, error: null }
  } catch {
    return { url: null, error: null }
  }
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

const PRO_FEATURES = [
  'Все найденные замечания, а не только топ-3',
  'Ссылки на конкретные пункты норм',
  'Рекомендации по исправлению',
  'Отчёт в PDF для подрядчика и экспертизы',
  'Чат по вашему отчёту: разбор замечаний и приоритетов по проекту',
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

function openExternal(url: string) {
  if (window.self !== window.top) window.open(url, '_blank', 'noopener,noreferrer')
  else window.location.href = url
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
  const [state, setState] = useState<DeepState>(
    initialDeep ? { kind: 'done', ...initialDeep } : { kind: 'idle' },
  )
  const price = DEEP_PRICE[request.jurisdiction]

  function handleChatCreated(chatUrl: string) {
    if (state.kind !== 'done') return
    const next = { pdfUrl: state.pdfUrl, report: state.report, chatUrl }
    onFullReport(next)
    setState({ kind: 'done', ...next })
  }

  async function requestDeepAudit() {
    if (!request.file) {
      setState({
        kind: 'error',
        message: 'Файл проекта не сохранился в браузере. Загрузите его заново, чтобы получить подробный аудит.',
      })
      return
    }
    const reportWindow = openReportWindow()
    const fail = (message: string) => {
      reportWindow?.close()
      setState({ kind: 'error', message })
    }
    setState({ kind: 'submitting' })
    const body = new FormData()
    body.append('file', request.file)
    body.append('email', request.email)
    body.append('jurisdiction', request.jurisdiction)
    body.append('consent_accepted', 'true')
    body.append('consent_version', consentVersion)
    if (request.auditId) body.append('audit_id', request.auditId)

    try {
      const res = await fetch(deepUrl, { method: 'POST', body })
      const raw = await res.text()
      let data: unknown = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      if (res.status === 429) {
        fail('Превышен лимит запросов. Повторите попытку немного позже.')
        return
      }
      if (!res.ok) {
        const detail = pickString(data, ['detail', 'message', 'error'])
        fail(detail ?? `Сервер вернул ошибку (HTTP ${res.status}).`)
        return
      }

      const paymentUrl = pickString(data, ['payment_url', 'checkout_url', 'confirmation_url'])
      if (paymentUrl) {
        if (reportWindow) reportWindow.location.href = paymentUrl
        else openExternal(paymentUrl)
        setState({ kind: 'idle' })
        setOpen(false)
        return
      }

      const report = typeof data === 'string' ? data : pickString(data, ['report', 'markdown', 'result'])
      const rawPdf = pickString(data, ['pdf_url', 'pdfUrl', 'download_url'])
      const pdfUrl = isRealPdfUrl(rawPdf) ? rawPdf : null
      if (!report && !pdfUrl) {
        fail('Сервер не вернул текст отчёта. Попробуйте ещё раз.')
        return
      }

      const chatUrl = report ? (await createChatLink(report, request.jurisdiction, request.email)).url : null
      if (pdfUrl && reportWindow) reportWindow.location.href = pdfUrl
      else if (report)
        showReportInWindow(reportWindow, { markdown: report, standards: getJurisdiction(request.jurisdiction).standards, chatUrl })
      onFullReport({ pdfUrl, report, chatUrl })
      setState({ kind: 'done', pdfUrl, report, chatUrl })
    } catch {
      fail('Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.')
    }
  }

  return (
    <>
      {state.kind === 'done' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
            Подробный аудит готов — открыт в новой вкладке
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
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-background px-5 text-sm font-semibold text-foreground transition-all hover:bg-background/90 active:scale-[0.99]"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Получить доступ (Pro)
          </button>
        </div>
      </div>
      )}

      <DeepAuditDialog
        open={open}
        onClose={() => {
          if (state.kind !== 'submitting') setOpen(false)
        }}
        price={price}
        email={request.email}
        jurisdiction={request.jurisdiction}
        state={state}
        onConfirm={requestDeepAudit}
        onChatCreated={handleChatCreated}
      />
    </>
  )
}

function DeepAuditDialog({
  open,
  onClose,
  price,
  email,
  jurisdiction,
  state,
  onConfirm,
  onChatCreated,
}: {
  open: boolean
  onClose: () => void
  price: string
  email: string
  jurisdiction: Jurisdiction
  state: DeepState
  onConfirm: () => void
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
              Подробный инженерный аудит
            </h2>
            <p className="text-xs text-muted-foreground">Тариф Pro · разовая оплата</p>
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
              Отчёт открыт в новой вкладке — там его можно сохранить в PDF. Если вкладка не появилась,
              нажмите кнопку ниже. Отчёт для <span className="font-medium text-foreground">{email}</span>.
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
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {PRO_FEATURES.map((feature) => (
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
          {state.kind !== 'done' && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/85 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Выполняем аудит…
                </>
              ) : (
                `Оплатить ${price}`
              )}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
