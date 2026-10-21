'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Timer,
  UploadCloud,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuditReport } from '@/components/audit-report'
import { ConsentDialog } from '@/components/consent-dialog'
import {
  fetchPromptTemplate,
  getJurisdiction,
  type Jurisdiction,
} from '@/components/jurisdiction-provider'
import { JurisdictionBadge, JurisdictionPicker } from '@/components/jurisdiction-select'
import { useSubmitCooldown } from '@/hooks/use-submit-cooldown'
import { PremiumUpsell } from '@/components/premium-upsell'
import { ExpressReport } from '@/components/express-report'
import { DEVELOPER_EXAMPLE_REPORT_URL, ExampleReportLink } from '@/components/example-report-link'
import { loadAuditChoice, TIER_EVENT, TIER_FRAME_COLOR, type AuditTier } from '@/lib/audit-tier'
import { buildAuditTeaser } from '@/lib/audit-teaser'
import {
  clearStoredAudit,
  loadStoredAudit,
  loadStoredFile,
  saveDeepReport,
  saveStoredAudit,
  type DeepReport,
} from '@/lib/audit-storage'

const AUDIT_API_BASE = 'https://stroy-audit-api.onrender.com/api/audit'
const EXPRESS_AUDIT_URL = `${AUDIT_API_BASE}/express`
const DEEP_AUDIT_URL = `${AUDIT_API_BASE}/deep`
const SUBMIT_COOLDOWN_MS = 60_000
const FLOOD_WARNING = 'Пожалуйста, подождите перед отправкой следующего отчета. Защита от спама активна.'

function parseRetryAfterMs(header: string | null) {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
  const date = Date.parse(header)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}
const MAX_SIZE_MB = 50
const REQUEST_TIMEOUT_MS = 180_000
const CONSENT_VERSION = '2026-10-21'

type Status = 'idle' | 'submitting' | 'success' | 'error'

type AuditResult = {
  ok: boolean
  httpStatus: number
  data: unknown
  jurisdiction: Jurisdiction
  templateWarning: string | null
  file: File | null
  email: string
  deep?: DeepReport | null
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif']
const SPREADSHEET_EXTENSIONS = ['.xls', '.xlsx']
const ALLOWED_EXTENSIONS = ['.pdf', ...IMAGE_EXTENSIONS, ...SPREADSHEET_EXTENSIONS]
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const ACCEPT_ATTR = [...ALLOWED_MIME_TYPES, ...ALLOWED_EXTENSIONS].join(',')

function hasExtension(file: File, extensions: string[]) {
  const name = file.name.toLowerCase()
  return extensions.some((ext) => name.endsWith(ext))
}

// HEIC files often arrive with an empty MIME type outside Safari, so the extension is checked too.
function isAllowedFile(file: File) {
  return ALLOWED_MIME_TYPES.includes(file.type) || hasExtension(file, ALLOWED_EXTENSIONS)
}

function FileKindIcon({ file }: { file: File }) {
  const className = 'size-4 shrink-0 text-muted-foreground'
  if (file.type.startsWith('image/') || hasExtension(file, IMAGE_EXTENSIONS)) {
    return <FileImage className={className} aria-hidden="true" />
  }
  if (hasExtension(file, SPREADSHEET_EXTENSIONS)) {
    return <FileSpreadsheet className={className} aria-hidden="true" />
  }
  return <FileText className={className} aria-hidden="true" />
}

const cardClass =
  'rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)]'

export function UploadCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<AuditResult | null>(null)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null)
  const [jurisdictionMissing, setJurisdictionMissing] = useState(false)
  const pickerRef = useRef<HTMLFieldSetElement>(null)
  const cooldown = useSubmitCooldown(SUBMIT_COOLDOWN_MS)
  const [floodWarning, setFloodWarning] = useState(false)
  const [missingPaidProject, setMissingPaidProject] = useState(false)
  const [auditChoice, setAuditChoice] = useState<AuditTier | null>(null)

  useEffect(() => {
    const syncChoice = () => setAuditChoice(loadAuditChoice())
    syncChoice()
    window.addEventListener(TIER_EVENT, syncChoice)
    return () => window.removeEventListener(TIER_EVENT, syncChoice)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paidReturn = params.get('payment') === 'success' || params.get('status') === 'success'
    const stored = loadStoredAudit()
    if (!stored) {
      if (paidReturn) setMissingPaidProject(true)
      return
    }
    let cancelled = false
    const restored: AuditResult = { ok: true, ...stored, file: null }
    setResult(restored)
    setStatus('success')
    loadStoredFile().then((storedFile) => {
      if (cancelled) return
      if (storedFile) {
        setResult((current) => (current === restored ? { ...restored, file: storedFile } : current))
        return
      }
      if (paidReturn) setMissingPaidProject(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function resetResult() {
    clearStoredAudit()
    setResult(null)
    setStatus('idle')
  }

  function selectJurisdiction(value: Jurisdiction) {
    setJurisdiction(value)
    setJurisdictionMissing(false)
    setError(null)
  }

  function clearFile() {
    setFile(null)
    setJurisdiction(null)
    setJurisdictionMissing(false)
  }

  function pickFile(list: FileList | null) {
    const picked = list?.[0]
    if (!picked) return
    if (!isAllowedFile(picked)) {
      setError(`Файл «${picked.name}» не подходит. Загрузите PDF, JPEG, PNG, HEIC или Excel.`)
      return
    }
    if (picked.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Файл «${picked.name}» больше ${MAX_SIZE_MB} МБ.`)
      return
    }
    setError(null)
    setFile(picked)
    setJurisdiction(null)
    setJurisdictionMissing(false)
    requestAnimationFrame(() =>
      pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'submitting') return
    if (cooldown.active) {
      setFloodWarning(true)
      return
    }
    if (!file) {
      setError('Добавьте файл проекта.')
      return
    }
    if (!jurisdiction) {
      setJurisdictionMissing(true)
      setError('Выберите строительные нормы, по которым проверять проект.')
      pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!consentAccepted) {
      setError('Подтвердите согласие с условиями обработки данных и дисклеймером.')
      return
    }
    setError(null)
    setFloodWarning(false)
    cooldown.start()
    runAudit(file, jurisdiction)
  }

  async function runAudit(file: File, selected: Jurisdiction) {
    setResult(null)
    setStatus('submitting')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let promptTemplate: string | null = null
    let templateWarning: string | null = null
    try {
      promptTemplate = await fetchPromptTemplate(selected, controller.signal)
    } catch {
      templateWarning = `Шаблон норм «${getJurisdiction(selected).standards}» пока недоступен — аудит выполнен с настройками сервера по умолчанию.`
    }

    const body = new FormData()
    body.append('file', file)
    body.append('email', email)
    body.append('consent_accepted', 'true')
    body.append('consent_version', CONSENT_VERSION)
    body.append('jurisdiction', selected)
    if (promptTemplate) body.append('prompt_template', promptTemplate)

    try {
      const res = await fetch(EXPRESS_AUDIT_URL, { method: 'POST', body, signal: controller.signal })
      if (res.status === 429) {
        const retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'))
        if (retryAfterMs && retryAfterMs > SUBMIT_COOLDOWN_MS) cooldown.start(retryAfterMs)
        const retryHint = retryAfterMs
          ? ` Повторите попытку через ${Math.ceil(retryAfterMs / 1000)} с.`
          : ' Повторите попытку немного позже.'
        setResult({
          ok: false,
          httpStatus: 429,
          jurisdiction: selected,
          templateWarning,
          file,
          email,
          data: `Превышен лимит запросов: сервер временно ограничил количество проверок с вашего устройства.${retryHint}`,
        })
        setStatus('error')
        return
      }
      const raw = await res.text()
      let data: unknown = raw
      try {
        data = JSON.parse(raw)
      } catch {}
      setResult({
        ok: res.ok,
        httpStatus: res.status,
        data,
        jurisdiction: selected,
        templateWarning,
        file,
        email,
      })
      if (res.ok) {
        saveStoredAudit({ httpStatus: res.status, data, jurisdiction: selected, templateWarning, email }, file)
      } else {
        clearStoredAudit()
      }
      setStatus(res.ok ? 'success' : 'error')
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setResult({
        ok: false,
        httpStatus: 0,
        jurisdiction: selected,
        templateWarning,
        file,
        email,
        data: aborted
          ? 'Сервер не ответил вовремя. Попробуйте ещё раз.'
          : 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.',
      })
      setStatus('error')
    } finally {
      clearTimeout(timeout)
    }
  }

  const submitting = status === 'submitting'

  return (
    <div className="flex flex-col gap-4">
      {missingPaidProject && (
        <p role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          Оплата прошла, но файл проекта в этом браузере не найден. Загрузите его ещё раз — полный отчёт запустится сразу.
        </p>
      )}

      <form
        id="upload"
        onSubmit={handleSubmit}
        aria-busy={submitting}
        className={cn(cardClass, 'flex scroll-mt-24 flex-col gap-4 p-5 text-left transition-colors sm:p-6')}
        style={auditChoice ? { borderColor: TIER_FRAME_COLOR[auditChoice] } : undefined}
        aria-label="Загрузка проекта для аудита"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold">Новый аудит</h2>
            {jurisdiction && <JurisdictionBadge value={jurisdiction} />}
          </div>
          <span className="font-mono text-xs text-muted-foreground">до {MAX_SIZE_MB} МБ</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!submitting) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!submitting) pickFile(e.dataTransfer.files)
          }}
          className={cn(
            'group flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-all duration-300',
            dragging
              ? 'scale-[1.01] border-foreground bg-black/[0.03]'
              : 'border-input bg-background hover:border-foreground/40',
            submitting && 'pointer-events-none opacity-60',
          )}
        >
          <span className="grid size-11 place-items-center rounded-full border border-border bg-card shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Перетащите файл проекта сюда</p>
            <p className="text-xs text-muted-foreground">
              или{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                выберите файл
              </button>
            </p>
          </div>
          <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Поддерживаемые форматы">
            {['PDF', 'JPEG', 'PNG', 'HEIC', 'Excel'].map((format) => (
              <li
                key={format}
                className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {format}
              </li>
            ))}
          </ul>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            aria-label="Выбрать файл проекта: PDF, JPEG, PNG, HEIC или Excel"
            onChange={(e) => {
              pickFile(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {file && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
            <FileKindIcon file={file} />
            <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{formatSize(file.size)}</span>
            <button
              type="button"
              disabled={submitting}
              onClick={clearFile}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label={`Удалить ${file.name}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {file && (
          <JurisdictionPicker
            ref={pickerRef}
            value={jurisdiction}
            onChange={selectJurisdiction}
            disabled={submitting}
            invalid={jurisdictionMissing}
          />
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Email для отчёта
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            disabled={submitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.ru"
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-shadow placeholder:text-muted-foreground/60 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/5 disabled:opacity-60"
          />
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="consent"
              type="checkbox"
              required
              disabled={submitting}
              checked={consentAccepted}
              onChange={(e) => {
                setConsentAccepted(e.target.checked)
                if (e.target.checked) setError(null)
              }}
              aria-describedby="consent-hint"
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <label htmlFor="consent" className="cursor-pointer">
                Я согласен с
              </label>{' '}
              {/* An <a> is used because browsers render <button> as inline-block, which stops the text from wrapping mid-phrase on mobile. */}
              <a
                href="#terms"
                role="button"
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.preventDefault()
                  if (!submitting) setTermsOpen(true)
                }}
                className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
              >
                условиями обработки данных и&nbsp;дисклеймером
              </a>
              <span className="text-warning" aria-hidden="true">
                &nbsp;*
              </span>
            </p>
          </div>
          {!submitting && (!file || !jurisdiction || !consentAccepted) && (
            <p id="consent-hint" className="text-[11px] text-muted-foreground/80">
              {!file
                ? 'Загрузите файл, затем выберите нормы и отметьте согласие'
                : !jurisdiction
                  ? 'Выберите строительные нормы, чтобы запустить аудит'
                  : 'Отметьте согласие, чтобы запустить аудит'}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-warning">
            {error}
          </p>
        )}

        {floodWarning && cooldown.active && (
          <div
            role="alert"
            className="animate-in fade-in slide-in-from-bottom-1 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 duration-300"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-foreground">
              {FLOOD_WARNING}{' '}
              <span className="text-muted-foreground">
                Осталось <span className="font-mono tabular-nums">{cooldown.secondsLeft}</span> с.
              </span>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !file || !jurisdiction || !consentAccepted}
          aria-disabled={cooldown.active || undefined}
          className={cn(
            'group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-all hover:bg-black/85 active:scale-[0.99] disabled:opacity-50',
            submitting ? 'disabled:cursor-wait disabled:opacity-70' : 'disabled:cursor-not-allowed disabled:hover:bg-primary',
            cooldown.active && !submitting && 'cursor-not-allowed opacity-50 hover:bg-primary active:scale-100',
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Анализируем проект…
            </>
          ) : cooldown.active ? (
            <>
              <Timer className="size-4" aria-hidden="true" />
              <span>
                Подождите <span className="font-mono tabular-nums">{cooldown.secondsLeft}</span>с...
              </span>
            </>
          ) : (
            <>
              Запустить экспресс-аудит
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </button>

        <div className="flex flex-col gap-2">
          <ExampleReportLink className="w-full" />
          <ExampleReportLink href={DEVELOPER_EXAMPLE_REPORT_URL} className="w-full">
            Посмотреть пример отчёта для застройщиков
          </ExampleReportLink>
        </div>

        {submitting ? (
          <div className="flex flex-col gap-2" role="status">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-[audit-progress_1.4s_ease-in-out_infinite] rounded-full bg-foreground" />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Это может занять до минуты.
            </p>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Исходные файлы удаляются сразу после обработки и не хранятся на сервере
          </p>
        )}
      </form>

      <ConsentDialog
        open={termsOpen}
        onAccept={() => {
          setConsentAccepted(true)
          setError(null)
          setTermsOpen(false)
        }}
        onClose={() => setTermsOpen(false)}
      />

      {result && <AuditResponse result={result} onReset={resetResult} />}
    </div>
  )
}

function AuditResponse({ result, onReset }: { result: AuditResult; onReset: () => void }) {
  const data = result.data
  const report =
    data && typeof data === 'object' && typeof (data as { report?: unknown }).report === 'string'
      ? (data as { report: string }).report
      : null
  const [fullReport, setFullReport] = useState<string | null>(result.deep?.report ?? null)
  const isText = typeof data === 'string' || report !== null
  const rawContent = report ?? (typeof data === 'string' ? data : JSON.stringify(data, null, 2))
  const usedJurisdiction = getJurisdiction(result.jurisdiction)
  const teaser =
    result.ok && isText && !fullReport ? buildAuditTeaser(data, report ?? rawContent) : null
  const content = fullReport ?? rawContent
  const showUpsell = result.ok

  return (
    <section
      id="audit-result"
      aria-live="polite"
      className={cn(
        cardClass,
        'animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3 p-5 text-left duration-500 sm:p-6',
      )}
    >
      <div className="flex items-center gap-2">
        {result.ok ? (
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
        )}
        <h3 className="text-sm font-bold">
          {!result.ok ? 'Ошибка аудита' : fullReport ? 'Подробный аудит' : 'Экспресс-аудит'}
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <span aria-hidden="true">{usedJurisdiction.flag}</span>
          {usedJurisdiction.standards}
        </span>
        {result.httpStatus > 0 && (
          <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            HTTP {result.httpStatus}
          </span>
        )}
      </div>

      {result.templateWarning && (
        <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-warning">
          {result.templateWarning}
        </p>
      )}

      {teaser ? (
        <ExpressReport teaser={teaser} fallback={rawContent} />
      ) : isText && !content.trim().startsWith('<') ? (
        content.trim() ? (
          <div className="max-h-[40rem] overflow-y-auto rounded-lg border border-border bg-card px-4 py-5 sm:px-6">
            <AuditReport markdown={content} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Пустой ответ сервера.</p>
        )
      ) : (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed">
          {content}
        </pre>
      )}

      {showUpsell && (
        <PremiumUpsell
          request={{
            file: result.file,
            email: result.email,
            jurisdiction: result.jurisdiction,
            auditId: teaser?.auditId ?? null,
          }}
          deepUrl={DEEP_AUDIT_URL}
          consentVersion={CONSENT_VERSION}
          hiddenCount={teaser?.hiddenCount ?? 0}
          initialDeep={result.deep ?? null}
          onFullReport={(deep) => {
            saveDeepReport(deep)
            if (deep.report) setFullReport(deep.report)
          }}
        />
      )}

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <RotateCcw className="size-3" aria-hidden="true" />
        Скрыть ответ
      </button>
    </section>
  )
}
