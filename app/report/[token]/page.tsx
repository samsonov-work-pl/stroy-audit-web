import type { Metadata } from 'next'
import Link from 'next/link'

import { getJurisdiction, type Jurisdiction } from '@/components/jurisdiction-provider'
import { ReportSession } from '@/components/report-session'
import { Logo } from '@/components/site-header'
import { findActiveSession, readChatHistory } from '@/lib/report-session'

export const metadata: Metadata = {
  title: 'Отчёт — СтройАудит.ai',
  robots: { index: false, follow: false },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="shrink-0 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-5">
          <Logo />
        </div>
      </header>
      {children}
    </div>
  )
}

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await Promise.race([
    findActiveSession(token).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ])
  if (!session) {
    return (
      <Shell>
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-10">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ссылка недействительна или её срок истёк. Отчёт и чат удаляются с сервера
            автоматически: через 14 дней после проверки, а по тарифу «Профи / Бизнес» — через 30
            дней. Поэтому мы советуем сохранять отчёт в PDF, пока ссылка активна.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Если письмо со ссылкой потерялось — проверьте папку «Спам». Новую проверку можно
            запустить в любой момент: экспресс-аудит бесплатный.
          </p>
          <Link
            href="/"
            className="w-fit rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Запустить новую проверку
          </Link>
        </div>
      </Shell>
    )
  }

  const daysLeft = Math.max(1, Math.ceil((session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
  const standards = session.jurisdiction
    ? getJurisdiction(session.jurisdiction as Jurisdiction).standards
    : 'строительные нормы России, Беларуси или Казахстана'

  return (
    <Shell>
      <ReportSession
        token={session.token}
        report={session.reportContent}
        initialHistory={readChatHistory(session.chatHistory)}
        initialCount={session.messageCount}
        daysLeft={daysLeft}
        standards={standards}
      />
    </Shell>
  )
}
