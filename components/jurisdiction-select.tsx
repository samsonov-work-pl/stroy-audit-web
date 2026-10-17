'use client'

import { forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JURISDICTIONS, getJurisdiction, type Jurisdiction } from '@/components/jurisdiction-provider'

type JurisdictionPickerProps = {
  value: Jurisdiction | null
  onChange: (value: Jurisdiction) => void
  disabled?: boolean
  invalid?: boolean
}

export const JurisdictionPicker = forwardRef<HTMLFieldSetElement, JurisdictionPickerProps>(
  function JurisdictionPicker({ value, onChange, disabled, invalid }, ref) {
    return (
      <fieldset
        ref={ref}
        disabled={disabled}
        aria-required="true"
        aria-invalid={invalid || undefined}
        aria-describedby="jurisdiction-hint"
        className={cn(
          'animate-in fade-in slide-in-from-top-1 flex scroll-mt-24 flex-col gap-2.5 rounded-xl border bg-background p-3 duration-300',
          invalid ? 'border-warning' : 'border-border',
        )}
      >
        <legend className="sr-only">Строительные нормы для проверки</legend>
        <div className="flex flex-col gap-0.5" aria-hidden="true">
          <p className="text-xs font-semibold text-foreground">
            По каким нормам проверить проект?<span className="text-warning"> *</span>
          </p>
        </div>
        <p id="jurisdiction-hint" className="-mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Выберите страну строительства — от этого зависят требования в отчёте.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {JURISDICTIONS.map((j) => {
            const checked = value === j.value
            return (
              <label
                key={j.value}
                className={cn(
                  'relative flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-2.5 py-2 transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-black/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                  checked
                    ? 'border-foreground shadow-sm'
                    : 'border-border hover:border-foreground/40',
                )}
              >
                <input
                  type="radio"
                  name="jurisdiction"
                  value={j.value}
                  checked={checked}
                  required
                  onChange={() => onChange(j.value)}
                  className="sr-only"
                />
                <span aria-hidden="true" className="text-base leading-5">
                  {j.flag}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold leading-5 text-foreground">{j.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{j.standards}</span>
                </span>
                {checked && (
                  <Check
                    className="absolute right-2 top-2 size-3.5 text-foreground"
                    aria-hidden="true"
                  />
                )}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  },
)

export function JurisdictionBadge({ value, className }: { value: Jurisdiction; className?: string }) {
  const current = getJurisdiction(value)

  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {current.flag}
      </span>
      <span>
        Нормы: <span className="text-foreground">{current.standards}</span>
      </span>
    </span>
  )
}
