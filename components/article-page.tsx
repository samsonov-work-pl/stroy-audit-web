import Link from 'next/link'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { articleLinks } from '@/lib/articles'

export type ArticleFaqItem = {
  question: string
  answer: string
}

export function ArticlePage({
  eyebrow = 'База знаний',
  title,
  current,
  faq,
  children,
  showOthers = true,
}: {
  eyebrow?: string
  title: string
  current: string
  faq?: ArticleFaqItem[]
  children: ReactNode
  showOthers?: boolean
}) {
  const others = articleLinks.filter((doc) => doc.href !== current)
  const faqJsonLd = faq
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      })
    : null

  return (
    <>
      <SiteHeader />
      <main className="border-b border-border">
        <article className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-16 md:py-24">
          <header className="flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em]">
              {title}
            </h1>
          </header>
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:pl-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
            {children}
            {faq ? (
              <section className="mt-6">
                <h2>Часто задаваемые вопросы</h2>
                <dl className="flex flex-col gap-4">
                  {faq.map((item) => (
                    <div key={item.question} className="flex flex-col gap-2">
                      <dt className="font-semibold text-foreground">{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
          {faqJsonLd ? (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: faqJsonLd }}
            />
          ) : null}
          {showOthers ? (
            <nav aria-label="Другие материалы" className="border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Читайте также
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
          ) : null}
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
