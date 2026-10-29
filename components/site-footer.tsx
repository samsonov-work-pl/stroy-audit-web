import Link from 'next/link'
import { Logo } from '@/components/site-header'
import { legalDocuments } from '@/lib/legal'
import { socialLinks } from '@/lib/social'

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4">
            <Logo />
            <nav aria-label="Telegram, Instagram и LinkedIn">
              <ul className="flex flex-col gap-2">
                {socialLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                    >
                      {link.name}
                      <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                        {link.handle}
                        {'hint' in link ? ` · ${link.hint}` : ''}
                      </span>
                      <span className="sr-only"> (откроется в новой вкладке)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <nav aria-label="Юридические документы">
            <ul className="flex flex-col gap-2 sm:items-end">
              {legalDocuments.map((doc) => (
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
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Отчёт СтройАудит.ai носит рекомендательный характер и не заменяет экспертизу
            проектной документации.
          </p>
          <p className="font-mono text-xs text-muted-foreground">© 2026 СтройАудит.ai</p>
        </div>
      </div>
    </footer>
  )
}
