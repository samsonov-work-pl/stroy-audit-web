'use client'

import type { ReactNode } from 'react'
import { useRubRates } from '@/components/fx-rates'
import { currencyFont, formatGrouped, referenceAmounts } from '@/lib/fx'
import { cn } from '@/lib/utils'

const priceClass = 'text-2xl font-extrabold leading-none tracking-[-0.03em] tabular-nums'

const FLAGS = {
  Россия: RussiaFlag,
  Беларусь: BelarusFlag,
  Казахстан: KazakhstanFlag,
} as const

export function TariffPrices({ amountRub }: { amountRub: number }) {
  const rates = useRubRates()
  const reference = amountRub > 0 && rates ? referenceAmounts(amountRub, rates) : null

  if (amountRub === 0) {
    return <p className={priceClass}>бесплатно</p>
  }

  const rows = [
    { country: 'Россия' as const, amount: formatGrouped(amountRub), symbol: '₽' },
    ...(reference
      ? [
          { country: 'Беларусь' as const, amount: `≈ ${formatGrouped(reference.byn)}`, symbol: 'BYN' },
          { country: 'Казахстан' as const, amount: `≈ ${formatGrouped(reference.kzt)}`, symbol: '₸' },
        ]
      : []),
  ]

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const Flag = FLAGS[row.country]
        return (
          <li key={row.country} className="flex items-center gap-2">
            <Flag />
            <span className={priceClass}>
              {row.amount} <span className={cn(currencyFont, 'font-semibold')}>{row.symbol}</span>
            </span>
            <span className="sr-only">{row.country}</span>
          </li>
        )
      })}
    </ul>
  )
}

function FlagFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 36 24"
      className="h-6 w-9 shrink-0 rounded-[2px] ring-1 ring-black/15"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function RussiaFlag() {
  return (
    <FlagFrame>
      <rect width="36" height="24" fill="#fff" />
      <rect y="8" width="36" height="8" fill="#0039A6" />
      <rect y="16" width="36" height="8" fill="#D52B1E" />
    </FlagFrame>
  )
}

function BelarusFlag() {
  return (
    <FlagFrame>
      <rect width="36" height="16" fill="#CF101A" />
      <rect y="16" width="36" height="8" fill="#007D30" />
      <rect width="5" height="24" fill="#fff" />
      <g fill="#CF101A">
        <rect x="1.6" y="1" width="1.8" height="1.6" />
        <rect x="1.6" y="4.2" width="1.8" height="1.6" />
        <rect x="1.6" y="7.4" width="1.8" height="1.6" />
        <rect x="1.6" y="10.6" width="1.8" height="1.6" />
        <rect x="1.6" y="13.8" width="1.8" height="1.6" />
        <rect x="1.6" y="17" width="1.8" height="1.6" />
        <rect x="1.6" y="20.2" width="1.8" height="1.6" />
      </g>
    </FlagFrame>
  )
}

function KazakhstanFlag() {
  const rays = Array.from({ length: 16 }, (_, index) => {
    const angle = (index * Math.PI) / 8
    return (
      <line
        key={index}
        x1={21 + Math.cos(angle) * 4.3}
        y1={12 + Math.sin(angle) * 4.3}
        x2={21 + Math.cos(angle) * 6.5}
        y2={12 + Math.sin(angle) * 6.5}
        stroke="#FEC50C"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    )
  })

  return (
    <FlagFrame>
      <rect width="36" height="24" fill="#00AFCA" />
      <rect x="2" width="1.4" height="24" fill="#FEC50C" />
      <circle cx="21" cy="12" r="3" fill="#FEC50C" />
      {rays}
    </FlagFrame>
  )
}
