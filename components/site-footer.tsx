import { Logo } from '@/components/site-header'

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Отчёт СтройАудит.ai носит рекомендательный характер и не заменяет экспертизу
          проектной документации.
        </p>
        <p className="font-mono text-xs text-muted-foreground">© 2026</p>
      </div>
    </footer>
  )
}
