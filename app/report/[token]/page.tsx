import type { Metadata } from 'next'

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
        <p className="mx-auto max-w-3xl px-5 py-10 text-sm leading-relaxed text-muted-foreground">
          Ссылка недействительна или её срок истёк. Отчёт и чат удаляются автоматически через 14 дней.
          Копия отчёта остаётся в письме, которое было отправлено на ваш email.
        </p>
      </Shell>
    )
  }

  const daysLeft = Math.max(1, Math.ceil((session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))

  return (
    <Shell>
      <ReportSession
        token={session.token}
        report={session.reportContent}
        initialHistory={readChatHistory(session.chatHistory)}
        initialCount={session.messageCount}
        daysLeft={daysLeft}
      />
    </Shell>
  )
}
