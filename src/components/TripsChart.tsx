import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hasStarted } from '../lib/derive.ts'
import { formatDateRange, formatPartialDate, todayIso } from '../lib/partialDate.ts'
import { nextMonth, tripsByMonth } from '../lib/stats.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { PRESSABLE_ROW } from './cards.ts'

type Range = '1Y' | '3Y' | 'All'
const RANGES: { id: Range; label: string; months: number }[] = [
  { id: '1Y', label: '1Y', months: 12 },
  { id: '3Y', label: '3Y', months: 36 },
  { id: 'All', label: 'All', months: Infinity },
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The plot: its height, room for the numbers on the left and the dates under it.
const PLOT_H = 150
const TOP = 8
const LEFT = 26
const AXIS_H = 22
// Bars are at most this wide (the rest of a month's slot is air), with a 2 px gap between them.
const MAX_BAR = 24
// Narrower than this per month, the chart scrolls sideways instead of squeezing the bars.
const MIN_SLOT = 6

/** "2024-06" a number of months back. */
function monthsBack(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) - n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** A bar with its top corners rounded (4 px) and its base square on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/** Whole-number lines for the height scale: every trip up to 5, else 0, half and the top. */
function ticksFor(max: number): number[] {
  if (max <= 5) return Array.from({ length: max + 1 }, (_, i) => i)
  const top = Math.ceil(max / 2) * 2
  return [0, top / 2, top]
}

/**
 * "Trips over time" on the profile: a bar per month for the trips that started in it (one dated
 * ahead is outlined), over the last year, three years or all of them. Point at or tap a month for
 * its count; tapping lists its trips under the chart. Trips dated only by year are counted in a
 * line under it, since they have no month.
 */
export function TripsChart({ data, onOpenTrip }: { data: TravelData; onOpenTrip: (trip: Trip) => void }) {
  const today = todayIso()
  const { months, yearOnly } = useMemo(() => tripsByMonth(data, today), [data, today])
  const [range, setRange] = usePersistentState<Range>('travel.profile.chartRange', '3Y', (v) => (v === '1Y' || v === 'All' ? v : '3Y'))
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  // The months shown: the range back from the newest (empty ones filled in), or all of them.
  const shown = useMemo(() => {
    if (months.length === 0) return []
    const end = months.at(-1)!.month
    const n = RANGES.find((r) => r.id === range)!.months
    const start = n === Infinity ? months[0].month : monthsBack(end, n - 1)
    const byMonth = new Map(months.map((m) => [m.month, m.trips]))
    const out: { month: string; trips: Trip[]; done: number; ahead: number }[] = []
    for (let m = start; m <= end; m = nextMonth(m)) {
      const trips = byMonth.get(m) ?? []
      const done = trips.filter((t) => hasStarted(t.startDate, today)).length
      out.push({ month: m, trips, done, ahead: trips.length - done })
    }
    return out
  }, [months, range, today])

  const total = data.trips.filter((t) => !t.deleted).length
  // Too few trips for a chart, or none dated to a month: a line instead.
  const charted = total >= 3 && shown.length > 0

  // The chart's width follows its box (measured again when the chart first appears).
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [charted])
  const plotW = Math.max(width - LEFT, shown.length * MIN_SLOT)
  // Scrolling (a long history): start at the newest month.
  useEffect(() => {
    if (box.current) box.current.scrollLeft = box.current.scrollWidth
  }, [range, plotW])

  if (!charted)
    return (
      <section aria-label="Trips over time">
        <h2 className="mb-2 font-display text-xl font-semibold">Trips over time</h2>
        <p className="text-sm text-muted">
          {total < 3 ? 'Log a few more trips to see them over time.' : 'Your trips are dated by year only, so there are no months to show them by.'}
        </p>
      </section>
    )

  const slot = shown.length ? plotW / shown.length : 0
  const barW = Math.max(2, Math.min(MAX_BAR, slot - 2))
  const ticks = ticksFor(Math.max(1, ...shown.map((m) => m.trips.length)))
  const yMax = ticks.at(-1)!
  const y = (n: number) => TOP + PLOT_H - (n / yMax) * PLOT_H
  const label = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`
  const counted = (n: number) => (n === 1 ? '1 trip' : `${n} trips`)
  const inRange = shown.reduce((n, m) => n + m.trips.length, 0)
  // The line above the chart follows what you point at (a month you picked has its own heading below).
  const pointed = shown.find((m) => m.month === hovered)
  const picked = shown.find((m) => m.month === selected)
  // Under the chart: each month's initial on a year view (Jan to Dec), else the year at each January.
  const dateLabel = (month: string, i: number) =>
    range === '1Y' ? (slot >= 28 ? MONTHS[Number(month.slice(5)) - 1] : MONTHS[Number(month.slice(5)) - 1][0]) : month.endsWith('-01') || i === 0 ? month.slice(0, 4) : null

  const step = (by: number) => {
    const at = shown.findIndex((m) => m.month === selected)
    const next = shown[Math.min(shown.length - 1, Math.max(0, at === -1 ? shown.length - 1 : at + by))]
    if (next) setSelected(next.month)
  }

  return (
    <section aria-label="Trips over time">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-display text-xl font-semibold">Trips over time</h2>
        <div role="radiogroup" aria-label="Range" className="ml-auto flex rounded-lg border border-line bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="radio"
              aria-checked={range === r.id}
              onClick={() => {
                setRange(r.id)
                setSelected(null)
              }}
              className={`min-h-9 min-w-11 rounded-md px-2 text-sm ${range === r.id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {/* What you're pointing at or picked; otherwise how many trips the chart covers. */}
      <p aria-live="polite" className="mb-1 text-sm">
        {pointed ? (
          <>
            <b>{counted(pointed.trips.length)}</b> <span className="text-muted">· {label(pointed.month)}</span>
            {pointed.ahead > 0 && <span className="text-muted"> · {pointed.ahead} upcoming</span>}
          </>
        ) : (
          <span className="text-muted">
            <b className="text-fg">{counted(inRange)}</b> {range === 'All' ? `since ${label(shown[0]?.month ?? today.slice(0, 7))}` : `in the last ${range === '1Y' ? 'year' : '3 years'}`}
          </span>
        )}
      </p>

      <div
        ref={box}
        tabIndex={0}
        aria-label="Trips by month. Left and right arrows pick a month."
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault()
            step(e.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
        onPointerLeave={() => setHovered(null)}
        className="overflow-x-auto overscroll-x-contain rounded-lg outline-offset-2"
      >
        {width > 0 && (
          <svg width={LEFT + plotW} height={TOP + PLOT_H + AXIS_H} aria-hidden className="block">
            {/* The height scale: hairlines with whole numbers. */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
                <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                  {t}
                </text>
              </g>
            ))}
            {shown.map((m, i) => {
              const x = LEFT + i * slot
              const bx = x + (slot - barW) / 2
              const doneTop = y(m.done)
              const aheadTop = y(m.trips.length)
              const text = dateLabel(m.month, i)
              return (
                <g key={m.month}>
                  {m.month === selected && <rect x={x} y={TOP} width={slot} height={PLOT_H} fill="var(--raised)" />}
                  {m.done > 0 && <path d={barPath(bx, doneTop, barW, TOP + PLOT_H - doneTop)} fill="var(--chart-bar)" />}
                  {/* Trips dated ahead: outlined, on top of the ones that happened, with a 2 px gap. */}
                  {m.ahead > 0 && (
                    <path
                      d={barPath(bx + 0.75, aheadTop + 0.75, barW - 1.5, Math.max(0, (m.done > 0 ? doneTop - 2 : TOP + PLOT_H) - aheadTop - 0.75))}
                      fill="none"
                      stroke="var(--chart-bar)"
                      strokeWidth="1.5"
                    />
                  )}
                  {text && (
                    // A year at the right edge ends there instead of running off it.
                    <text
                      x={range === '1Y' ? x + slot / 2 : x + 32 > LEFT + plotW ? LEFT + plotW : x + 1}
                      y={TOP + PLOT_H + 15}
                      textAnchor={range === '1Y' ? 'middle' : x + 32 > LEFT + plotW ? 'end' : 'start'}
                      fontSize="11"
                      fill="var(--muted)"
                    >
                      {text}
                    </text>
                  )}
                  {/* The whole month is the target, not just its bar. */}
                  <rect
                    x={x}
                    y={TOP}
                    width={slot}
                    height={PLOT_H + AXIS_H}
                    fill="transparent"
                    className="cursor-pointer"
                    onPointerEnter={() => setHovered(m.month)}
                    onClick={() => setSelected(selected === m.month ? null : m.month)}
                  />
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>Trips by month</caption>
        <tbody>
          {shown
            .filter((m) => m.trips.length > 0)
            .map((m) => (
              <tr key={m.month}>
                <th scope="row">{label(m.month)}</th>
                <td>{counted(m.trips.length)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {picked && (
        <section aria-label={`Trips in ${label(picked.month)}`} className="mt-3">
          <h3 className="mb-1.5 text-sm font-bold">
            {label(picked.month)} · {counted(picked.trips.length)}
          </h3>
          {picked.trips.length === 0 ? (
            <p className="text-sm text-muted">No trips that month.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {picked.trips.map((t) => (
                <li key={t.id}>
                  <button onClick={() => onOpenTrip(t)} className={`${PRESSABLE_ROW} min-h-12`}>
                    <span className="min-w-0 flex-1 truncate font-bold">{t.title}</span>
                    <span className="shrink-0 text-sm text-muted">
                      {formatDateRange(t.startDate, t.endDate, t.approximate)}
                      {!hasStarted(t.startDate, today) && ' · upcoming'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {yearOnly.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {yearOnly.length === 1 ? '1 trip is' : `${yearOnly.length} trips are`} dated by year only ({[...new Set(yearOnly.map((t) => formatPartialDate(t.startDate)))].join(', ')}), so
          {yearOnly.length === 1 ? " it isn't" : " they aren't"} shown by month.
        </p>
      )}
    </section>
  )
}
