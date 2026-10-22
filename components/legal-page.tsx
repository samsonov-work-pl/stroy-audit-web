import Link from 'next/link'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { LEGAL_UPDATED, legalDocuments } from '@/lib/legal'

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (откроется в новой вкладке)</span>
    </a>
  )
}

export function LegalPage({
  title,
  current,
  updated = LEGAL_UPDATED,
  children,
}: {
  title: string
  current: (typeof legalDocuments)[number]['href']
  updated?: string
  children: ReactNode
}) {
  const others = legalDocuments.filter((doc) => doc.href !== current)

  return (
    <>
      <SiteHeader />
      <main className="border-b border-border">
        <article className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-16 md:py-24">
          <header className="flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Документы сервиса
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em]">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">Редакция от {updated}</p>
          </header>
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:pl-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
            {children}
          </div>
          <nav aria-label="Другие документы" className="border-t border-border pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              См. также
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {others.map((doc) => (
                <li key={doc.href}>
                  <Link
                    href={doc.href}
                    className="text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                  >
                    {doc.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
