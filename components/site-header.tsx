import Link from 'next/link'

const links = [
  { href: '#how', label: 'Как это работает' },
  { href: '#report', label: 'Пример отчёта' },
  { href: '#pricing', label: 'Тарифы' },
  { href: '#contacts', label: 'Контакты' },
]

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="СтройАудит.ai — на главную">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-primary font-mono text-[11px] font-bold text-primary-foreground"
      >
        СА
      </span>
      <span className="text-sm font-bold tracking-tight text-foreground">
        СтройАудит<span className="text-muted-foreground">.ai</span>
      </span>
    </Link>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav aria-label="Основная навигация" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="#upload"
            className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-px hover:bg-black/85"
          >
            Начать аудит
          </a>
        </div>
      </div>
    </header>
  )
}
