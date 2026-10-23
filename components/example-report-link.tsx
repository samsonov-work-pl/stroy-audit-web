import { ArrowUpRight, FileText } from 'lucide-react'

import { cn } from '@/lib/utils'

export const EXAMPLE_REPORT_URL = process.env.NEXT_PUBLIC_EXAMPLE_REPORT_URL || '/reports/example-report.pdf'
export const DEVELOPER_EXAMPLE_REPORT_URL =
  process.env.NEXT_PUBLIC_DEVELOPER_EXAMPLE_REPORT_URL || '/reports/example-report-for-developer.pdf'

export function ExampleReportLink({
  className,
  href = EXAMPLE_REPORT_URL,
  children = 'Посмотреть пример полного отчёта',
  tone = 'default',
}: {
  className?: string
  href?: string
  children?: React.ReactNode
  tone?: 'default' | 'onDark'
}) {
  const onDark = tone === 'onDark'
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center justify-center gap-1.5 transition-colors',
        onDark
          ? 'w-full px-1 py-0.5 text-center text-xs font-medium leading-snug text-background/75 hover:text-background hover:underline'
          : 'h-10 gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted',
        className,
      )}
    >
      <FileText className={cn('shrink-0', onDark ? 'size-3.5 text-background/70' : 'size-4 text-muted-foreground')} aria-hidden="true" />
      {children}
      <ArrowUpRight
        className={cn(
          'shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
          onDark ? 'size-3 text-background/70' : 'size-3.5 text-muted-foreground',
        )}
        aria-hidden="true"
      />
      <span className="sr-only">(PDF, откроется в новой вкладке)</span>
    </a>
  )
}
