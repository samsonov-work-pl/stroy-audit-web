'use client'

import type { ClipboardEvent, MouseEvent } from 'react'
import { CheckCircle2, ClipboardList, Lock, ThumbsUp } from 'lucide-react'

import { AuditReport } from '@/components/audit-report'
import type { AuditTeaser, IssueSeverity, TeaserIssue } from '@/lib/audit-teaser'
import { cn } from '@/lib/utils'

const SEVERITY: Record<IssueSeverity, { label: string; dot: string; text: string }> = {
  critical: { label: 'Критично', dot: 'bg-red-500', text: 'text-red-500' },
  major: { label: 'Важно', dot: 'bg-amber-500', text: 'text-amber-500' },
  minor: { label: 'Рекомендация', dot: 'bg-sky-500', text: 'text-sky-500' },
}

const blockCopy = (event: ClipboardEvent | MouseEvent) => event.preventDefault()

function SectionTitle({ index, icon: Icon, children }: { index: number; icon: typeof ThumbsUp; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-bold">
      <span className="font-mono text-xs text-muted-foreground">{String(index).padStart(2, '0')}</span>
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      {children}
    </h4>
  )
}

function SeverityTag({ severity }: { severity: IssueSeverity }) {
  const s = SEVERITY[severity]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold', s.text)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  )
}

function IssueRow({ issue, index }: { issue: TeaserIssue; index: number }) {
  return (
    <li className="flex gap-3 border-t border-border py-3 first:border-t-0">
      <span className="w-5 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">{index}.</span>
      <div className="flex min-w-0 flex-col gap-1">
        <SeverityTag severity={issue.severity} />
        <div className="text-sm leading-relaxed [&_p]:m-0">
          <AuditReport markdown={issue.text} />
        </div>
      </div>
    </li>
  )
}

const LOCKED_PLACEHOLDER = [
  'Лист АР-3, узел 2: несоответствие требованиям п. 5.2.4 — способ исправления и расчёт',
  'Раздел КР: проверка армирования плиты перекрытия с указанием конкретных пунктов норм',
  'Пожарная безопасность: противопожарные расстояния и пути эвакуации — готовое решение',
  'Теплотехника: сопротивление теплопередаче ограждающих конструкций и рекомендации',
]

export function ExpressReport({ teaser, fallback }: { teaser: AuditTeaser; fallback: string }) {
  const total = teaser.shownCount + teaser.hiddenCount
  const hasStats = total > 0
  const structured = hasStats && teaser.shown.length > 0
  const lockedRows =
    teaser.locked.length > 0
      ? teaser.locked.map((i) => ({ severity: i.severity, text: i.text }))
      : LOCKED_PLACEHOLDER.map((text, i) => ({ severity: (['critical', 'major', 'major', 'minor'] as const)[i], text }))
  let section = 0

  if (!structured) {
    return (
      <article
        className="flex select-none flex-col divide-y divide-border rounded-lg border border-border bg-card [-webkit-touch-callout:none] [-webkit-user-select:none] print:hidden"
        onCopy={blockCopy}
        onCut={blockCopy}
        onContextMenu={blockCopy}
        onDragStart={blockCopy}
      >
        {hasStats && <StatsRow teaser={teaser} />}
        <section className="px-4 py-5 sm:px-6">
          <AuditReport markdown={fallback} />
        </section>
        <LockedBlock rows={lockedRows} startIndex={1} hiddenCount={teaser.hiddenCount} />
      </article>
    )
  }

  return (
    <article
      className="flex select-none flex-col divide-y divide-border rounded-lg border border-border bg-card [-webkit-touch-callout:none] [-webkit-user-select:none] print:hidden"
      onCopy={blockCopy}
      onCut={blockCopy}
      onContextMenu={blockCopy}
      onDragStart={blockCopy}
    >
      <StatsRow teaser={teaser} />

      <section className="flex flex-col gap-3 px-4 py-5 sm:px-6">
        <SectionTitle index={++section} icon={ClipboardList}>
          Резюме
        </SectionTitle>
        {teaser.summary || !hasStats ? (
          <AuditReport markdown={teaser.summary || fallback} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Найдено {total} замечаний. Ниже — ключевые из них.
          </p>
        )}
      </section>

      {teaser.strengths.length > 0 && (
        <section className="flex flex-col gap-3 px-4 py-5 sm:px-6">
          <SectionTitle index={++section} icon={ThumbsUp}>
            Плюсы проекта
          </SectionTitle>
          <ul className="flex flex-col gap-2">
            {teaser.strengths.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>{item.replace(/[*_]/g, '')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(
        <section className="flex flex-col gap-1 px-4 pt-5 sm:px-6">
          <SectionTitle index={++section} icon={Lock}>
            Замечания
            <span className="ml-1 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
              {teaser.shownCount} из {total}
            </span>
          </SectionTitle>

          <ol className="mt-2">
            {teaser.shown.map((issue, i) => (
              <IssueRow key={`${i}-${issue.text}`} issue={issue} index={i + 1} />
            ))}
          </ol>

        </section>
      )}
      <LockedBlock rows={lockedRows} startIndex={teaser.shownCount + 1} hiddenCount={teaser.hiddenCount} />
    </article>
  )
}

function StatsRow({ teaser }: { teaser: AuditTeaser }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border">
      {(Object.keys(SEVERITY) as IssueSeverity[]).map((key) => (
        <div key={key} className="flex flex-col gap-1 px-4 py-4">
          <span className={cn('font-mono text-2xl font-bold tabular-nums', SEVERITY[key].text)}>
            {teaser.stats[key]}
          </span>
          <span className="text-[11px] text-muted-foreground">{SEVERITY[key].label}</span>
        </div>
      ))}
    </div>
  )
}

function LockedBlock({
  rows,
  startIndex,
  hiddenCount,
}: {
  rows: { severity: IssueSeverity; text: string }[]
  startIndex: number
  hiddenCount: number
}) {
  return (
    <div className="relative overflow-hidden" onCopy={blockCopy} onCut={blockCopy} onContextMenu={blockCopy} onDragStart={blockCopy}>
      <ol aria-hidden="true" className="pointer-events-none select-none px-4 pb-24 blur-sm sm:px-6">
        {rows.map((row, i) => (
          <li key={i} className="flex gap-3 border-t border-border py-3 first:border-t-0">
            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{startIndex + i}.</span>
            <div className="flex flex-col gap-1">
              <SeverityTag severity={row.severity} />
              <p className="text-sm leading-relaxed">{row.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 bg-gradient-to-b from-card/10 via-card/85 to-card px-4 pb-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold">
          {hiddenCount > 0 ? `Ещё ${hiddenCount} замечаний — в подробном отчёте` : 'Детали и решения — в подробном отчёте'}
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Номера листов, ссылки на пункты норм и готовые решения по каждому замечанию.
        </p>
      </div>
    </div>
  )
}
