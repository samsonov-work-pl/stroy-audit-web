import { ArrowUpRight, FileText } from 'lucide-react'

import { Reveal } from '@/components/reveal'
import { SectionHeading } from '@/components/how-it-works'
import { DEVELOPER_EXAMPLE_REPORT_URL, EXAMPLE_REPORT_URL } from '@/components/example-report-link'
import { ExampleReportPages } from '@/components/example-report-pages'

const fileName = EXAMPLE_REPORT_URL.split('/').pop()?.split('?')[0] || 'example-report.pdf'

export function AuditPreview() {
  return (
    <section id="report" className="scroll-mt-16 border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-5 py-24 md:py-32">
        <SectionHeading
          eyebrow="Пример отчёта"
          title="Каждое замечание — со ссылкой на норму и листом чертежа"
        />

        <Reveal delay={100}>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_60px_-24px_rgba(0,0,0,0.15)]">
            <div className="flex flex-col gap-3 border-b border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-mono text-sm">{fileName}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={EXAMPLE_REPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Открыть PDF целиком
                  <ArrowUpRight
                    className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(откроется в новой вкладке)</span>
                </a>
                <a
                  href={DEVELOPER_EXAMPLE_REPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Пример для застройщиков
                  <ArrowUpRight
                    className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(PDF, откроется в новой вкладке)</span>
                </a>
              </div>
            </div>

            <ExampleReportPages />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
