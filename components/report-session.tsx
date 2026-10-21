'use client'

import { FormEvent, useState } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'

import { AuditReport } from '@/components/audit-report'
import { MAX_CHAT_MESSAGES, type ChatTurn } from '@/lib/report-limits'

export function ReportSession({
  token,
  report,
  initialHistory,
  initialCount,
  daysLeft,
}: {
  token: string
  report: string
  initialHistory: ChatTurn[]
  initialCount: number
  daysLeft: number
}) {
  const [history, setHistory] = useState(initialHistory)
  const [remaining, setRemaining] = useState(Math.max(0, MAX_CHAT_MESSAGES - initialCount))
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || pending || remaining <= 0) return
    setPending(true)
    setError(null)
    setInput('')
    setHistory((current) => [...current, { role: 'user', content: question }])
    setRemaining((current) => current - 1)
    try {
      const res = await fetch(`/api/report/${token}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      })
      const data = (await res.json().catch(() => null)) as { reply?: unknown; remaining?: unknown; error?: unknown } | null
      if (!res.ok || typeof data?.reply !== 'string') {
        setRemaining((current) => current + 1)
        setHistory((current) => current.slice(0, -1))
        setInput(question)
        setError(typeof data?.error === 'string' ? data.error : 'Не удалось получить ответ.')
        return
      }
      if (typeof data.remaining === 'number') setRemaining(data.remaining)
      setHistory((current) => [...current, { role: 'assistant', content: data.reply as string }])
    } catch {
      setRemaining((current) => current + 1)
      setHistory((current) => current.slice(0, -1))
      setInput(question)
      setError('Не удалось связаться с сервером.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-8">
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed">
        Ссылка на этот отчёт и чат активна ещё {daysLeft} дн. Исходные файлы на сервере не хранятся.
      </p>
      <article className="rounded-2xl border border-border bg-card px-4 py-5 sm:px-6">
        <AuditReport markdown={report} />
      </article>
      <section className="flex flex-col gap-4" aria-label="Чат по отчёту">
        <h2 className="text-lg font-bold">Вопросы по отчёту</h2>
        {history.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ассистент отвечает только по этому отчёту. Можно задать до {MAX_CHAT_MESSAGES} вопросов.
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
      </section>
    </div>
  )
}
