import type { Metadata } from 'next'

import { getJurisdiction, type Jurisdiction } from '@/components/jurisdiction-provider'
import { BrowserProjectChat, ProjectChat } from '@/components/project-chat'
import { Logo } from '@/components/site-header'
import { findPaidProject, loadMessages, MAX_USER_MESSAGES } from '@/lib/chat-project'

export const metadata: Metadata = {
  title: 'Чат по проекту — СтройАудит.ai',
  robots: { index: false, follow: false },
}

export default async function ChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const project = await findPaidProject(token).catch(() => null)
  if (!project) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <header className="shrink-0 border-b border-border/70 bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-3xl items-center px-5">
            <Logo />
          </div>
        </header>
        <BrowserProjectChat token={token} />
      </div>
    )
  }

  const messages = await loadMessages(project.id)
  const standards = getJurisdiction(project.jurisdiction as Jurisdiction).standards

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="shrink-0 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5">
          <Logo />
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            {standards}
          </span>
        </div>
      </header>
      <ProjectChat
        token={token}
        initialMessages={messages}
        remaining={Math.max(0, MAX_USER_MESSAGES - project.messageCount)}
      />
    </div>
  )
}
