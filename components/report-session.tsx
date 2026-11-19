'use client'

import { FormEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, Loader2, Paperclip, X } from 'lucide-react'

import { AuditReport } from '@/components/audit-report'
import { MAX_CHAT_MESSAGES, type ChatTurn } from '@/lib/report-limits'
import { openReportWindow, showReportInWindow } from '@/lib/report-pdf'

/** Лимит файла для чата — заметно меньше лимита аудита из-за ограничения тела запроса у Vercel. */
const MAX_ATTACHMENT_MB = 4

function attachmentError(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) return 'К вопросу можно прикрепить только PDF-файл.'
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    return `Файл «${file.name}» больше ${MAX_ATTACHMENT_MB} МБ. Пришлите его в чат одним листом или сжатием.`
  }
  if (file.size === 0) return 'Файл пустой — проверьте, что прикрепили нужный документ.'
  return null
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export function ReportSession({
  token,
  report,
  initialHistory,
  initialCount,
  daysLeft,
  standards,
  canAttachFiles = false,
}: {
  token: string
  report: string
  initialHistory: ChatTurn[]
  initialCount: number
  daysLeft: number
  standards: string
  canAttachFiles?: boolean
}) {
  const [history, setHistory] = useState(initialHistory)
  const [remaining, setRemaining] = useState(Math.max(0, MAX_CHAT_MESSAGES - initialCount))
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportHidden, setReportHidden] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function pickAttachment(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const problem = attachmentError(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setAttachment(file)
  }

  function savePdf() {
    const win = openReportWindow()
    showReportInWindow(win, { markdown: report, standards })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || pending || remaining <= 0) return
    const file = attachment
    setPending(true)
    setError(null)
    setInput('')
    setAttachment(null)
    setHistory((current) => [
      ...current,
      { role: 'user', content: file ? `${question}\n\n(к вопросу приложен файл «${file.name}»)` : question },
    ])
    setRemaining((current) => current - 1)
    try {
      let res: Response
      if (file) {
        const form = new FormData()
        form.append('message', question)
        form.append('file', file)
        res = await fetch(`/api/report/${token}/chat`, { method: 'POST', body: form })
      } else {
        res = await fetch(`/api/report/${token}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question }),
        })
      }
      const data = (await res.json().catch(() => null)) as { reply?: unknown; remaining?: unknown; error?: unknown } | null
      if (!res.ok || typeof data?.reply !== 'string') {
        setRemaining((current) => current + 1)
        setHistory((current) => current.slice(0, -1))
        setInput(question)
        if (file) setAttachment(file)
        setError(typeof data?.error === 'string' ? data.error : 'Не удалось получить ответ.')
        return
      }
      if (typeof data.remaining === 'number') setRemaining(data.remaining)
      setHistory((current) => [...current, { role: 'assistant', content: data.reply as string }])
    } catch {
      setRemaining((current) => current + 1)
      setHistory((current) => current.slice(0, -1))
      setInput(question)
      if (file) setAttachment(file)
      setError('Не удалось связаться с сервером.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="min-w-0 text-sm leading-relaxed">
          Ссылка на этот отчёт и чат активна ещё {daysLeft} дн. Сохраните отчёт в PDF, пока ссылка
          работает: после окончания срока он удаляется с сервера. Исходные файлы не хранятся.
        </p>
        <button
          type="button"
          onClick={savePdf}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Сохранить в PDF
        </button>
        <button
          type="button"
          onClick={() => setReportHidden((value) => !value)}
          aria-expanded={!reportHidden}
          aria-controls="report-content"
          className="shrink-0 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
        >
          {reportHidden ? 'Показать отчёт' : 'Скрыть отчёт'}
        </button>
      </div>
      {reportHidden ? null : (
        <article id="report-content" className="rounded-2xl border border-border bg-card px-4 py-5 sm:px-6">
          <AuditReport markdown={report} />
        </article>
      )}
      <section className="flex flex-col gap-4" aria-label="Чат по отчёту">
        <h2 className="text-lg font-bold">Вопросы по отчёту</h2>
        {history.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ассистент отвечает только по этому отчёту. Можно задать до {MAX_CHAT_MESSAGES} вопросов.
            {canAttachFiles
              ? ` К вопросу можно прикрепить дополнительный файл проекта (PDF до ${MAX_ATTACHMENT_MB} МБ) — ассистент ответит по нему, не запуская новый аудит.`
              : ''}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {history.map((turn, index) =>
              turn.role === 'user' ? (
                <p
                  key={`${index}-user`}
                  className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground"
                >
                  {turn.content}
                </p>
              ) : (
                <div key={`${index}-assistant`} className="text-sm leading-relaxed">
                  <AuditReport markdown={turn.content} />
                </div>
              ),
            )}
          </div>
        )}
        <form onSubmit={submit} className="flex flex-col gap-2">
          {attachment ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {attachment.name} · {formatSize(attachment.size)}
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                disabled={pending}
                aria-label="Убрать прикреплённый файл"
                className="grid size-8 shrink-0 place-items-center rounded-xl border border-border text-foreground disabled:opacity-40"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
            <label htmlFor="report-question" className="sr-only">
              Вопрос по отчёту
            </label>
            <textarea
              id="report-question"
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 4000))}
              rows={2}
              disabled={pending || remaining <= 0}
              placeholder={remaining > 0 ? 'Спросите о замечаниях в отчёте…' : 'Лимит вопросов исчерпан'}
              className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            {canAttachFiles ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={pending || remaining <= 0}
                  onChange={(event) => {
                    pickAttachment(event.target.files)
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending || remaining <= 0}
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-foreground disabled:opacity-40"
                  aria-label="Прикрепить файл проекта к вопросу"
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                </button>
              </>
            ) : null}
            <button
              type="submit"
              disabled={pending || remaining <= 0 || !input.trim()}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Отправить вопрос"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Осталось вопросов: {remaining} из {MAX_CHAT_MESSAGES}
          </p>
          {error ? (
            <p role="alert" className="text-center text-xs text-warning">
              {error}
            </p>
          ) : null}
        </form>
        {remaining <= 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-center">
            <p className="text-sm leading-relaxed">
              Лимит вопросов по этому отчёту исчерпан: ассистент отвечает только по отчёту, к
              которому открыта ссылка. Сам отчёт и история чата доступны до конца срока ссылки.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Чтобы разобрать другой вопрос или новый проект, запустите новую проверку —
              экспресс-аудит бесплатный.
            </p>
            <Link
              href="/"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Запустить новую проверку
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  )
}
