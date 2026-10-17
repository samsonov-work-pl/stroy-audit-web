'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { ArrowUp, Loader2, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const SUGGESTIONS = [
  'Какие замечания нужно исправить в первую очередь?',
  'Хочу уточнить данные по фундаменту',
  'Какие этапы строительства важно проконтролировать?',
]

const MAX_INPUT = 4000

function messageText(message: UIMessage) {
  return message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
}

export function ProjectChat({
  token,
  initialMessages,
  remaining: initialRemaining,
}: {
  token: string
  initialMessages: UIMessage[]
  remaining: number
}) {
  const [input, setInput] = useState('')
  const [remaining, setRemaining] = useState(initialRemaining)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, stop, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { token, message: messages[messages.length - 1] },
      }),
    }),
  })

  const busy = status === 'submitted' || status === 'streaming'
  const lastMessage = messages.at(-1)
  const awaitingText =
    status === 'submitted' ||
    (status === 'streaming' && (lastMessage?.role !== 'assistant' || messageText(lastMessage).trim() === ''))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, status])

  function submit(text: string) {
    const value = text.trim()
    if (!value || busy || remaining <= 0) return
    sendMessage({ text: value })
    setRemaining((r) => r - 1)
    setInput('')
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-lg font-bold text-balance">Чат по вашему проекту</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Ассистент знает ваш подробный отчёт. Дополните информацию о проекте, обсудите замечания или
                  получите рекомендации по контролю важных этапов строительства.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                  {messageText(message)}
                </p>
              </div>
            ) : messageText(message).trim() === '' ? null : (
              <div key={message.id} className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] text-muted-foreground">Инженер-ассистент</span>
                <div className="chat-markdown text-sm leading-relaxed text-foreground">
                  <ReactMarkdown components={{ img: () => null }}>{messageText(message)}</ReactMarkdown>
                </div>
              </div>
            ),
          )}

          {awaitingText ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Анализируем проект…
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              Не удалось получить ответ. Попробуйте ещё раз.
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background">
        <form
          className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
            <label htmlFor="chat-input" className="sr-only">
              Сообщение
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  submit(input)
                }
              }}
              rows={1}
              disabled={remaining <= 0}
              placeholder={remaining > 0 ? 'Спросите о проекте или дополните данные…' : 'Лимит сообщений исчерпан'}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground [field-sizing:content]"
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
                aria-label="Остановить ответ"
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || remaining <= 0}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Отправить"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            {`Осталось сообщений: ${remaining} · Ассистент не заменяет официальную экспертизу`}
          </p>
        </form>
      </div>
    </main>
  )
}
