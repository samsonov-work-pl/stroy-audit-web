import { ArrowUpRight, FileText } from 'lucide-react'

import { cn } from '@/lib/utils'

export const EXAMPLE_REPORT_URL = process.env.NEXT_PUBLIC_EXAMPLE_REPORT_URL || '/reports/example-report.pdf'

export function ExampleReportLink({ className }: { className?: string }) {
  return (
    <a
      href={EXAMPLE_REPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted',
        className,
      )}
    >
      <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
      Посмотреть пример полного отчёта
      <ArrowUpRight
        className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
      <span className="sr-only">(PDF, откроется в новой вкладке)</span>
    </a>
  )
}
