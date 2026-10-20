'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { SectionHeading } from '@/components/how-it-works'
import { loadAuditChoice, saveAuditChoice, TIER_EVENT, TIER_FRAME_COLOR, type AuditTier } from '@/lib/audit-tier'
import { cn } from '@/lib/utils'

type Currency = 'BYN' | 'RUB' | 'KZT'

// Manrope and JetBrains Mono lack the ₽/₸ glyphs, so symbols use Noto Sans.
const currencyFont = 'font-[family-name:var(--font-currency)]'

const currencies: { id: Currency; symbol: string; country: string }[] = [
  { id: 'RUB', symbol: '₽', country: 'Россия' },
  { id: 'BYN', symbol: 'BYN', country: 'Беларусь' },
  { id: 'KZT', symbol: '₸', country: 'Казахстан' },
]

const plans: {
  name: string
  tier: AuditTier
  period: string
  prices: Record<Currency, string>
  features: string[]
  popular: boolean
}[] = [
  {
    name: 'Экспресс',
    tier: 'express',
    period: 'за один проект',
    prices: { BYN: 'бесплатно', RUB: 'бесплатно', KZT: 'бесплатно' },
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
    prices: { BYN: '249', RUB: '7 900', KZT: '39 900' },
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
    prices: { BYN: '899', RUB: '29 900', KZT: '149 900' },
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

// Emoji flags don't render on Windows, so flags are drawn with CSS.
function Flag({ currency }: { currency: Currency }) {
  const base = 'relative h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10'

  if (currency === 'BYN') {
    return (
      <span aria-hidden="true" className={cn(base, 'flex flex-col')}>
        <span className="flex-[2] bg-[#C8313E]" />
        <span className="flex-1 bg-[#4AA657]" />
        <span className="absolute inset-y-0 left-0 w-1 bg-white bg-[repeating-linear-gradient(to_bottom,#C8313E_0_2px,transparent_2px_4px)]" />
      </span>
    )
  }

  if (currency === 'RUB') {
    return (
      <span aria-hidden="true" className={cn(base, 'flex flex-col')}>
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#0039A6]" />
        <span className="flex-1 bg-[#D52B1E]" />
      </span>
    )
  }

  return (
    <span aria-hidden="true" className={cn(base, 'flex items-center justify-center bg-[#00AFCA]')}>
      <span className="size-1.5 rounded-full bg-[#FEC50C]" />
      <span className="absolute inset-y-0 left-0.5 w-0.5 bg-[repeating-linear-gradient(to_bottom,#FEC50C_0_1px,transparent_1px_3px)]" />
    </span>
  )
}

export function Pricing() {
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
                  <dl className="flex flex-col gap-2">
                    {currencies.map((c, idx) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <dt className="flex items-center">
                          <Flag currency={c.id} />
                          <span className="sr-only">{c.country}</span>
                        </dt>
                        <dd
                          className={cn(
                            'font-extrabold tracking-[-0.03em] tabular-nums',
                            idx === 0 ? 'text-4xl' : 'text-2xl text-foreground/80',
                          )}
                        >
                          {plan.prices[c.id]}{' '}
                          <span className={cn(currencyFont, 'font-semibold text-muted-foreground')}>
                            {c.symbol}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
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
      </div>
    </section>
  )
}
