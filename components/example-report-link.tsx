import { ArrowUpRight, FileText } from 'lucide-react'

import { cn } from '@/lib/utils'

export const EXAMPLE_REPORT_URL = process.env.NEXT_PUBLIC_EXAMPLE_REPORT_URL || '/reports/example-report.pdf'
export const DEVELOPER_EXAMPLE_REPORT_URL =
  process.env.NEXT_PUBLIC_DEVELOPER_EXAMPLE_REPORT_URL || '/reports/example-report-for-developer.pdf'

export function ExampleReportLink({
  className,
  href = EXAMPLE_REPORT_URL,
  children = 'Посмотреть пример полного отчёта',
}: {
  className?: string
  href?: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted',
        className,
      )}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {children}
      <ArrowUpRight
        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
      <span className="sr-only">(PDF, откроется в новой вкладке)</span>
    </a>
  )
}
