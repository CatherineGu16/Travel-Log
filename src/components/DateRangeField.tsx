import { useId, useState } from 'react'
import { comparePartialDates, formatDateRange, precisionOf, todayIso, type DatePrecision } from '../lib/partialDate.ts'
import type { PartialDate } from '../lib/types.ts'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const pad = (n: number) => String(n).padStart(2, '0')
const UNIT: Record<DatePrecision, string> = { day: 'day', month: 'month', year: 'year' }

/** Converts a date to another precision: "2024-05-03" → "2024-05" → "2024", or back to the 1st. */
function toPrecision(date: PartialDate, p: DatePrecision): PartialDate {
  if (p === 'year') return date.slice(0, 4)
  if (p === 'month') return date.length >= 7 ? date.slice(0, 7) : `${date.slice(0, 4)}-01`
  return date.length === 10 ? date : date.length === 7 ? `${date}-01` : `${date}-01-01`
}

/** Earliest and latest of the two, so a range always reads forward. */
const ordered = (a: PartialDate, b: PartialDate): [PartialDate, PartialDate] => (comparePartialDates(a, b) <= 0 ? [a, b] : [b, a])

/**
 * A date range: tap the first day, then the last. Date, month or year precision, for trips you
 * only half remember. The typed fields underneath jump straight to any date.
 */
export function DateRangeField({
  label,
  start,
  end,
  onChange,
}: {
  label: string
  start: PartialDate
  end: PartialDate
  onChange: (start: PartialDate, end: PartialDate) => void
}) {
  const id = useId()
  const precision = precisionOf(start)
  // The next tap sets the start (then the range collapses to that one day) or the end.
  const [picking, setPicking] = useState<'start' | 'end'>('start')
  // The month, year or decade the grid is showing.
  const viewOf = (d: PartialDate) => ({ year: Number(d.slice(0, 4)), month: d.length >= 7 ? Number(d.slice(5, 7)) : 1 })
  const [view, setView] = useState(() => viewOf(start))
  // When the start changes from outside (typed, or filled in from destinations), show it.
  const [shownStart, setShownStart] = useState(start)
  if (shownStart !== start) {
    setShownStart(start)
    const v = viewOf(start)
    if (precision !== 'day' || v.year !== view.year || v.month !== view.month) setView(v)
  }

  const tap = (date: PartialDate) => {
    if (picking === 'start') {
      onChange(date, date)
      setPicking('end')
    } else {
      onChange(...ordered(start, date))
      setPicking('start')
    }
  }

  const switchTo = (p: DatePrecision) => {
    onChange(toPrecision(start, p), toPrecision(end, p))
    setPicking('start')
  }

  const inRange = (d: PartialDate) => comparePartialDates(d, start) >= 0 && comparePartialDates(d, end) <= 0
  const cell = (d: PartialDate, text: string, ariaLabel: string, extra = '') => {
    const isEdge = d === start || d === end
    const within = inRange(d)
    return (
      <button
        key={d}
        type="button"
        aria-label={ariaLabel}
        aria-pressed={within}
        onClick={() => tap(d)}
        className={`grid h-10 place-items-center text-sm tabular-nums ${extra} ${
          isEdge ? 'rounded-lg bg-primary font-bold text-on-primary' : within ? 'bg-primary/15 font-bold' : 'rounded-lg hover:bg-raised'
        } ${d === todayIso().slice(0, d.length) && !within ? 'ring-1 ring-line' : ''}`}
      >
        {text}
      </button>
    )
  }

  const nav = (title: React.ReactNode, prev: () => void, next: () => void, what: string) => (
    <div className="mb-1 flex items-center gap-1">
      <button type="button" aria-label={`Previous ${what}`} onClick={prev} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg">
        ‹
      </button>
      <div className="flex flex-1 items-center justify-center gap-1 text-sm font-bold">{title}</div>
      <button type="button" aria-label={`Next ${what}`} onClick={next} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg">
        ›
      </button>
    </div>
  )

  const move = (months: number) =>
    setView((v) => {
      const total = v.year * 12 + (v.month - 1) + months
      return { year: Math.floor(total / 12), month: (total % 12) + 1 }
    })

  let grid: React.ReactNode
  if (precision === 'day') {
    const first = new Date(view.year, view.month - 1, 1).getDay()
    const days = new Date(view.year, view.month, 0).getDate()
    grid = (
      <>
        {nav(
          <>
            <select aria-label={`${label} calendar month`} value={view.month} onChange={(e) => setView({ ...view, month: Number(e.target.value) })} className="rounded-md bg-transparent px-1 font-bold">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <YearSelect label={`${label} calendar year`} year={view.year} onYear={(year) => setView({ ...view, year })} />
          </>,
          () => move(-1),
          () => move(1),
          'month',
        )}
        <div className="grid grid-cols-7 text-center text-xs text-muted">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: first }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = `${view.year}-${pad(view.month)}-${pad(i + 1)}`
            return cell(d, String(i + 1), `${MONTHS[view.month - 1]} ${i + 1}, ${view.year}`)
          })}
        </div>
      </>
    )
  } else if (precision === 'month') {
    grid = (
      <>
        {nav(<YearSelect label={`${label} calendar year`} year={view.year} onYear={(year) => setView({ ...view, year })} />, () => move(-12), () => move(12), 'year')}
        <div className="grid grid-cols-4 gap-y-0.5">
          {MONTHS.map((m, i) => cell(`${view.year}-${pad(i + 1)}`, m.slice(0, 3), `${m} ${view.year}`))}
        </div>
      </>
    )
  } else {
    const from = Math.floor(view.year / 12) * 12
    grid = (
      <>
        {nav(
          <span>
            {from} – {from + 11}
          </span>,
          () => setView({ ...view, year: view.year - 12 }),
          () => setView({ ...view, year: view.year + 12 }),
          'years',
        )}
        <div className="grid grid-cols-4 gap-y-0.5">{Array.from({ length: 12 }, (_, i) => cell(String(from + i), String(from + i), String(from + i)))}</div>
      </>
    )
  }

  const input = 'h-10 w-full min-w-0 rounded-lg border border-line bg-bg px-2 text-base'
  const typed = (which: 'start' | 'end') => {
    const value = which === 'start' ? start : end
    const set = (v: PartialDate) => onChange(...(which === 'start' ? ordered(v, end) : ordered(start, v)))
    const name = `${label} ${which}`
    if (precision === 'day')
      return <input type="date" aria-label={name} value={value} max="2100-12-31" onChange={(e) => e.target.value && set(e.target.value)} className={input} />
    if (precision === 'month')
      return (
        <input
          type="month"
          aria-label={name}
          value={value}
          onChange={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && set(e.target.value)}
          className={input}
        />
      )
    return (
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        aria-label={name}
        key={value}
        defaultValue={value}
        // Committed on blur so typing isn't interrupted.
        onBlur={(e) => (/^(19|20)\d{2}$/.test(e.target.value) ? set(e.target.value) : (e.target.value = value))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`${input} tabular-nums`}
      />
    )
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex w-full items-baseline gap-2 text-sm font-bold">
        {label}
        <span className="font-normal text-muted" aria-live="polite" id={`${id}-summary`}>
          {formatDateRange(start, end)}
        </span>
      </legend>
      <div role="radiogroup" aria-label={`${label} precision`} className="mb-2 flex w-fit rounded-lg bg-bg p-0.5">
        {(
          [
            ['day', 'Date'],
            ['month', 'Month'],
            ['year', 'Year'],
          ] as const
        ).map(([p, text]) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={precision === p}
            onClick={() => switchTo(p)}
            className={`min-h-9 rounded-md px-3 text-sm ${precision === p ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-bg p-2">
        {grid}
        <p className="mt-1 px-1 text-xs text-muted">
          {picking === 'start' ? `Tap the first ${UNIT[precision]}.` : `Now tap the last ${UNIT[precision]} (or the same one again).`}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {typed('start')}
        {typed('end')}
      </div>
    </fieldset>
  )
}

function YearSelect({ label, year, onYear }: { label: string; year: number; onYear: (y: number) => void }) {
  const now = Number(todayIso().slice(0, 4))
  const years = Array.from({ length: now - 1950 + 3 }, (_, i) => now + 2 - i)
  if (!years.includes(year)) years.push(year)
  return (
    <select aria-label={label} value={year} onChange={(e) => onYear(Number(e.target.value))} className="rounded-md bg-transparent px-1 font-bold">
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )
}
