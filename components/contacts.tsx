import type { IconType } from 'react-icons'
import { FaInstagram, FaLinkedinIn, FaTelegram, FaVk } from 'react-icons/fa6'
import { SiGmail } from 'react-icons/si'
import { ArrowUpRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { SectionHeading } from '@/components/how-it-works'

const contacts: { name: string; handle: string; href: string; icon: IconType }[] = [
  {
    name: 'Gmail',
    handle: 'stroyaudit.ai@gmail.com',
    href: 'mailto:stroyaudit.ai@gmail.com',
    icon: SiGmail,
  },
  {
    name: 'LinkedIn',
    handle: 'СтройАудит.ai',
    href: 'https://www.linkedin.com/company/stroyaudit-ai',
    icon: FaLinkedinIn,
  },
  {
    name: 'Instagram',
    handle: '@stroyaudit.ai',
    href: 'https://www.instagram.com/stroyaudit.ai',
    icon: FaInstagram,
  },
  {
    name: 'ВКонтакте',
    handle: 'vk.com/stroyaudit_ai',
    href: 'https://vk.com/stroyaudit_ai',
    icon: FaVk,
  },
  {
    name: 'Telegram',
    handle: '@stroyaudit_ai',
    href: 'https://t.me/stroyaudit_ai',
    icon: FaTelegram,
  },
]

export function Contacts() {
  return (
    <section id="contacts" className="scroll-mt-16 border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-5 py-24 md:py-32">
        <div className="flex flex-col gap-4">
          <SectionHeading eyebrow="Контакты" title="Остались вопросы? Напишите нам" />
          <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Отвечаем в рабочее время в течение часа. Выберите удобный способ связи.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {contacts.map((contact, i) => {
            const Icon = contact.icon
            const isEmail = contact.href.startsWith('mailto:')
            return (
              <Reveal as="li" key={contact.name} delay={i * 80}>
                <a
                  href={contact.href}
                  {...(isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="group flex h-full flex-col gap-6 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.15)]"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <ArrowUpRight
                      className="size-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-bold tracking-tight">{contact.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {contact.handle}
                    </span>
                  </div>
                  {!isEmail && <span className="sr-only">(откроется в новой вкладке)</span>}
                </a>
              </Reveal>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
