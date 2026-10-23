'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useRubRates } from '@/components/fx-rates'
import { Reveal } from '@/components/reveal'
import { SectionHeading } from '@/components/how-it-works'
import { loadAuditChoice, saveAuditChoice, TIER_EVENT, TIER_FRAME_COLOR, type AuditTier } from '@/lib/audit-tier'
import { currencyFont, formatGrouped, referenceAmounts, TARIFF_RUB } from '@/lib/fx'
import { cn } from '@/lib/utils'

const plans: {
  name: string
  tier: AuditTier
  period: string
  amountRub: number
  features: string[]
  popular: boolean
}[] = [
  {
    name: 'Экспресс',
    tier: 'express',
    period: 'за один проект',
    amountRub: TARIFF_RUB.express,
    features: [
      'Проверка чертежей по нормам',
      'Наиболее значимые, важные замечания и рекомендации',
      'Файлы до 50МБ',
    ],
    popular: false,
  },
  {
    name: 'Полный аудит',
    tier: 'full',
    period: 'за один проект',
    amountRub: TARIFF_RUB.full,
    features: [
      'Всё из тарифа «Экспресс»',
      'Все найденные замечания со ссылками на нормы',
      'Подробное описание всех замечаний',
      'Чек лист проверки на объекте выполненных работ',
      'Чат по вашему отчёту',
      'Без ограничения по листам',
    ],
    popular: true,
  },
  {
    name: 'Для застройщиков',
    tier: 'developer',
    period: 'в месяц',
    amountRub: TARIFF_RUB.developer,
    features: [
      'Всё из тарифа «Полный аудит»',
      'Приоритетная обработка',
      'Анализ смет и спецификаций',
      'Рекомендации для строителей и проектировщиков',
      'Чат-обсуждение по каждому проекту',
      'API и командный доступ',
      'До 20 проектов в месяц',
    ],
    popular: false,
  },
]

function Price({ amountRub }: { amountRub: number }) {
  const rates = useRubRates()
  const reference = amountRub > 0 && rates ? referenceAmounts(amountRub, rates) : null

  return (
    <div className="flex flex-col gap-1">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {amountRub === 0 ? (
          <span className="text-4xl font-extrabold tracking-[-0.03em]">бесплатно</span>
        ) : (
          <span className="text-4xl font-extrabold tracking-[-0.03em] tabular-nums">
            {formatGrouped(amountRub)} <span className={cn(currencyFont, 'font-semibold')}>₽</span>
          </span>
        )}
        {reference && (
          <span className="text-sm font-semibold tabular-nums text-foreground/70">
            (≈ {formatGrouped(reference.byn)} BYN / {formatGrouped(reference.kzt)} <span className={currencyFont}>₸</span>)
          </span>
        )}
      </p>
    </div>
  )
}

export function Pricing() {
  const rates = useRubRates()
  const [selected, setSelected] = useState<AuditTier | null>(null)

  useEffect(() => {
    const sync = () => setSelected(loadAuditChoice())
    sync()
    window.addEventListener(TIER_EVENT, sync)
    return () => window.removeEventListener(TIER_EVENT, sync)
  }, [])

  return (
    <section id="pricing" className="scroll-mt-16 border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-5 py-24 md:py-32">
        <SectionHeading eyebrow="Тарифы" title="Дешевле одной ошибки в проекте" />

        <ul className="grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal as="li" key={plan.name} delay={i * 100}>
              <div
                className={cn(
                  'relative flex h-full flex-col gap-7 rounded-2xl border bg-card p-7 transition-all duration-300 hover:-translate-y-1 md:p-8',
                  plan.popular
                    ? 'border-foreground shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]'
                    : 'border-border hover:border-foreground/20 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.15)]',
                )}
                style={selected === plan.tier ? { borderColor: TIER_FRAME_COLOR[plan.tier] } : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold tracking-tight">{plan.name}</h3>
                  {plan.popular && (
                    <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
                      Популярный
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Price amountRub={plan.amountRub} />
                  <p className="text-sm text-muted-foreground">{plan.period}</p>
                </div>

                <ul className="flex flex-1 flex-col gap-3 border-t border-border pt-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#upload"
                  aria-pressed={selected === plan.tier}
                  onClick={() => saveAuditChoice(plan.tier)}
                  className={cn(
                    'inline-flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-all active:scale-[0.99]',
                    plan.popular
                      ? 'border-transparent bg-primary text-primary-foreground hover:bg-black/85'
                      : 'border-border bg-card text-foreground hover:border-foreground',
                  )}
                  style={selected === plan.tier ? { borderColor: TIER_FRAME_COLOR[plan.tier] } : undefined}
                >
                  {selected === plan.tier ? 'Выбран' : 'Выбрать'}
                  <span className="sr-only"> тариф «{plan.name}»</span>
                </a>
              </div>
            </Reveal>
          ))}
        </ul>

        <div className="flex max-w-3xl flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Оплата принимается банковскими картами. Списание происходит в российских рублях (RUB) по курсу вашего
            банка-эмитента.
          </p>
          {rates && (
            <p>Суммы в BYN и KZT указаны справочно по текущему курсу относительно RUB.</p>
          )}
        </div>
      </div>
    </section>
  )
}
