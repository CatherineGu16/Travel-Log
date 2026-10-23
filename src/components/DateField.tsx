import { useId } from 'react'
import { precisionOf, todayIso } from '../lib/partialDate.ts'
import type { PartialDate } from '../lib/types.ts'

type Precision = 'day' | 'month' | 'year' | 'unknown'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * A date you may only half remember: exact day, month and year, just the year, or unknown.
 * Uses native inputs so iPhone gets its wheel picker and Windows its calendar.
 */
export function DateField({
  label,
  value,
  onChange,
  allowUnknown = true,
  unknownHint = 'No date.',
}: {
  label: string
  value: PartialDate | null
  onChange: (v: PartialDate | null) => void
  allowUnknown?: boolean
  unknownHint?: string
}) {
  const id = useId()
  const precision: Precision = value === null ? 'unknown' : precisionOf(value)
  const year = value?.slice(0, 4) ?? todayIso().slice(0, 4)
  const month = value && value.length >= 7 ? value.slice(5, 7) : todayIso().slice(5, 7)

  const switchTo = (p: Precision) => {
    const base = value ?? todayIso()
    if (p === 'unknown') onChange(null)
    else if (p === 'year') onChange(base.slice(0, 4))
    else if (p === 'month') onChange(base.length >= 7 ? base.slice(0, 7) : `${base.slice(0, 4)}-${month}`)
    else onChange(base.length === 10 ? base : `${base.length >= 7 ? base.slice(0, 7) : `${base.slice(0, 4)}-${month}`}-01`)
  }

  const precisions: { id: Precision; label: string }[] = [
    { id: 'day', label: 'Date' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
    ...(allowUnknown ? [{ id: 'unknown' as const, label: 'Unknown' }] : []),
  ]

  const input = 'h-11 rounded-lg border border-line bg-bg px-3 text-base'

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">{label}</legend>
      <div role="radiogroup" aria-label={`${label} precision`} className="mb-2 flex w-fit rounded-lg bg-bg p-0.5">
        {precisions.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={precision === p.id}
            onClick={() => switchTo(p.id)}
            className={`min-h-9 rounded-md px-2.5 text-sm ${precision === p.id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {precision === 'day' && (
        <input
          id={id}
          type="date"
          aria-label={label}
          value={value ?? ''}
          max="2100-12-31"
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={`${input} w-full max-w-56`}
        />
      )}
      {precision === 'month' && (
        <div className="flex gap-2">
          <select aria-label={`${label} month`} value={month} onChange={(e) => onChange(`${year}-${e.target.value}`)} className={`${input} min-w-0 flex-1`}>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>
                {m}
              </option>
            ))}
          </select>
          <YearInput label={label} year={year} onYear={(y) => onChange(`${y}-${month}`)} className={input} />
        </div>
      )}
      {precision === 'year' && <YearInput label={label} year={year} onYear={(y) => onChange(y)} className={input} />}
      {precision === 'unknown' && <p className="text-sm text-muted">{unknownHint}</p>}
    </fieldset>
  )
}

function YearInput({ label, year, onYear, className }: { label: string; year: string; onYear: (y: string) => void; className: string }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      aria-label={`${label} year`}
      defaultValue={year}
      // Committed on blur so typing isn't interrupted; tapping Save blurs first.
      onBlur={(e) => (/^(19|20)\d{2}$/.test(e.target.value) ? onYear(e.target.value) : (e.target.value = year))}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`${className} w-24 tabular-nums`}
    />
  )
}
