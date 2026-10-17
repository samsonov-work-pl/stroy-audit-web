'use client'

import useSWR from 'swr'
import { AlertCircle } from 'lucide-react'

import { EXAMPLE_REPORT_URL } from '@/components/example-report-link'
import { loadPdfPreview } from '@/lib/pdf-preview'

const MAX_PREVIEW_PAGES = 6
const A4_RATIO = '595 / 842'

export function ExampleReportPages() {
  const { data, error, isLoading } = useSWR(
    ['example-report', EXAMPLE_REPORT_URL],
    ([, url]) => loadPdfPreview(url, MAX_PREVIEW_PAGES),
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false },
  )

  if (error) {
    return (
      <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        Не удалось показать превью. Откройте PDF по кнопке выше.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 md:p-5">
      <ol
        aria-label="Страницы примера отчёта"
        aria-busy={isLoading}
        className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 px-3 pb-2 sm:-mx-4 sm:scroll-px-4 sm:px-4 md:-mx-5 md:gap-4 md:scroll-px-5 md:px-5"
      >
        {isLoading || !data
          ? Array.from({ length: 3 }, (_, i) => (
              <li
                key={i}
                className="w-[78%] shrink-0 snap-start animate-pulse rounded-lg border border-border bg-muted sm:w-[46%] md:w-[calc((100%-2rem)/3)]"
                style={{ aspectRatio: A4_RATIO }}
              >
                <span className="sr-only">Загрузка страницы</span>
              </li>
            ))
          : data.pages.map((page) => (
              <li
                key={page.number}
                className="flex w-[78%] shrink-0 snap-start flex-col gap-2 sm:w-[46%] md:w-[calc((100%-2rem)/3)]"
              >
                <a
                  href={`${EXAMPLE_REPORT_URL}#page=${page.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-border bg-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <img
                    src={page.imageUrl}
                    width={page.width}
                    height={page.height}
                    alt={`Страница ${page.number}: ${page.text.slice(0, 200)}`}
                    className="block h-auto w-full"
                  />
                </a>
                <span className="font-mono text-xs text-muted-foreground">
                  Стр. {page.number} / {data.totalPages}
                </span>
              </li>
            ))}
      </ol>
      {data && data.totalPages > data.pages.length && (
        <p className="text-xs text-muted-foreground">
          Показаны первые {data.pages.length} из {data.totalPages} страниц.
        </p>
      )}
    </div>
  )
}
