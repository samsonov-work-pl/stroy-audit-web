'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import { ShieldAlert, X } from 'lucide-react'

type ConsentDialogProps = {
  open: boolean
  onAccept: () => void
  onClose: () => void
}

export function ConsentDialog({ open, onAccept, onClose }: ConsentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

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
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-5 text-left sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-background">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-base font-bold text-balance">
              Условия обработки данных и дисклеймер
            </h2>
            <p className="text-xs text-muted-foreground">Редакция от 21.10.2026</p>
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

        <div
          id={descId}
          className="flex max-h-[45vh] flex-col gap-3 overflow-auto rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground"
        >
          <p>
            <span className="font-semibold text-foreground">Отказ от ответственности.</span>{' '}
            Отчёт формируется автоматически с помощью алгоритмов и искусственного интеллекта и носит
            рекомендательный характер. Он не является экспертизой проектной документации и не
            заменяет проверку квалифицированным специалистом или государственную экспертизу.
          </p>
          <p>
            Сервис не несёт ответственности за решения, принятые на основании отчёта, а также за
            возможные неточности и пропущенные замечания.
          </p>
          <p>
            <span className="font-semibold text-foreground">Обработка данных.</span> Загружая файл,
            вы подтверждаете, что имеете право на его передачу, и даёте согласие на обработку
            указанного email и содержимого документа в целях проведения аудита. Для пользователей из
            России, Беларуси и Казахстана обработка ведётся по закону страны пользователя. Подробности
            — в{' '}
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
              Политике конфиденциальности
            </Link>
            . Исходные файлы удаляются сразу после обработки и не хранятся на сервере. Отчёт и чат
            по разовому тарифу хранятся до 14 дней.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/85"
          >
            Принимаю условия
          </button>
        </div>
      </div>
    </dialog>
  )
}
