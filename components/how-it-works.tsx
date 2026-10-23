import { FileUp, ClipboardCheck, ScanSearch, Wrench } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const steps = [
  {
    icon: FileUp,
    title: 'Загрузите файлы',
    text: 'Загрузите фото чертежей и эскизов (JPEG, PNG, HEIC), файлы в PDF или сметы в Excel — архитектурные, конструктивные или инженерные разделы.',
  },
  {
    icon: ScanSearch,
    title: 'ИИ анализирует',
    text: 'Распознавание листов, сверка с нормативами и проверка объемов в смете.',
  },
  {
    icon: ClipboardCheck,
    title: 'Получите отчёт',
    text: 'Через 15 минут — список замечаний, риски и оценка влияния на бюджет.',
  },
  {
    icon: Wrench,
    title: 'Обсудите и исправьте',
    text: 'Задайте вопросы по замечаниям в чате по вашему отчёту, затем передайте рекомендации проектировщику и подрядчику до начала работ.',
  },
]

export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Reveal className="flex max-w-3xl flex-col gap-4">
      <h2 className="flex flex-col gap-4">
        <span className="font-mono text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
        <span className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
          {title}
        </span>
      </h2>
    </Reveal>
  )
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-5 py-24 md:py-32">
        <SectionHeading eyebrow="Процесс" title="Как это работает" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <Reveal as="li" key={step.title} delay={i * 90}>
                <div className="group flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.15)]">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg border border-border bg-background transition-colors duration-300 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </Reveal>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
