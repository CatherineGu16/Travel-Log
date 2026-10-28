import { useEffect, useRef, useState } from 'react'
import { addDays, comparePartialDates, dayOfTrip, precisionOf, tripDays } from '../lib/partialDate.ts'
import type { PartialDate } from '../lib/types.ts'
import { DateRangeField } from './DateRangeField.tsx'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Longer trips get the calendar: a strip of more days than this is slower than a month grid. */
const MAX_STRIP_DAYS = 60

/**
 * When you were at one stop. For a trip with whole-day dates, a strip of the trip's days: tap the
 * day you arrived, then the day you left (or the same day again), and it closes. It opens on the
 * day the stop before ended. Otherwise, or for days outside the trip, the calendar.
 */
export function StopDates({
  place,
  tripStart,
  tripEnd,
  start,
  end,
  suggested,
  calendarOnly,
  onChange,
  onDone,
}: {
  place: string
  tripStart: PartialDate
  tripEnd: PartialDate
  start: PartialDate | null
  end: PartialDate | null
  /** Where the strip opens and what it highlights: the day the stop before ended. */
  suggested: PartialDate | null
  /** Use the calendar (e.g. a new trip, whose dates come from its stops). */
  calendarOnly: boolean
  onChange: (start: PartialDate | null, end: PartialDate | null) => void
  onDone: () => void
}) {
  const length = tripDays(tripStart, tripEnd)
  const outside = !!start && (comparePartialDates(start, tripStart) < 0 || comparePartialDates(end ?? start, tripEnd) > 0)
  const [calendar, setCalendar] = useState(calendarOnly || length === null || length > MAX_STRIP_DAYS || outside || (!!start && precisionOf(start) !== 'day'))
  const [picking, setPicking] = useState<'first' | 'last'>('first')
  const strip = useRef<HTMLDivElement>(null)

  // Open on the stop's own first day, else the suggested one (where it was when the strip appeared,
  // not wherever each pick moves it).
  const opensOn = useRef(start ?? suggested)
  useEffect(() => {
    const day = opensOn.current && dayOfTrip(tripStart, opensOn.current)
    if (day && strip.current) strip.current.children[day - 1]?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [calendar, tripStart])

  const actions = (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {start && (
        <button type="button" onClick={() => onChange(null, null)} className="min-h-9 rounded-lg px-2 text-muted hover:bg-raised hover:text-fg">
          Clear
        </button>
      )}
      {!calendar && (
        <button type="button" onClick={() => setCalendar(true)} className="min-h-9 rounded-lg px-2 text-muted hover:bg-raised hover:text-fg">
          Other dates…
        </button>
      )}
      <button type="button" onClick={onDone} className="ml-auto min-h-9 rounded-lg px-3 font-bold text-primary hover:bg-raised">
        Done
      </button>
    </div>
  )

  if (calendar)
    return (
      <div className="flex flex-col gap-1 border-t border-line p-2">
        <DateRangeField
          defaultOpen
          label={`Dates at ${place}`}
          start={start ?? suggested ?? tripStart}
          end={end ?? start ?? suggested ?? tripStart}
          onChange={(s, e) => onChange(s, e === s ? null : e)}
        />
        {actions}
      </div>
    )

  const days = Array.from({ length: length! }, (_, i) => addDays(tripStart, i))
  const last = end ?? start
  const tap = (day: PartialDate) => {
    if (picking === 'first' || !start) {
      onChange(day, null)
      setPicking('last')
      return
    }
    const [a, b] = comparePartialDates(day, start) < 0 ? [day, start] : [start, day]
    onChange(a, a === b ? null : b)
    setPicking('first')
    onDone()
  }
  return (
    <div className="flex flex-col gap-1 border-t border-line p-2" role="group" aria-label={`Days at ${place}`}>
      <p className="px-1 text-xs text-muted">{picking === 'first' || !start ? 'Tap the day you got here.' : 'Now the day you left (or the same day again).'}</p>
      <div ref={strip} className="flex snap-x gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {days.map((day, i) => {
          const within = !!start && !!last && comparePartialDates(day, start) >= 0 && comparePartialDates(day, last) <= 0
          const edge = day === start || day === last
          const hint = !start && day === suggested
          const date = new Date(`${day}T12:00:00Z`)
          return (
            <button
              key={day}
              type="button"
              aria-pressed={within}
              aria-label={`Day ${i + 1}, ${WEEKDAYS[date.getUTCDay()]} ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`}
              onClick={() => tap(day)}
              className={`flex w-14 shrink-0 snap-start flex-col items-center rounded-lg border py-1 text-xs leading-tight ${
                edge
                  ? 'border-primary bg-primary font-bold text-on-primary'
                  : within
                    ? 'border-primary/40 bg-primary/15 font-bold'
                    : hint
                      ? 'border-dashed border-primary text-fg'
                      : 'border-line text-muted hover:bg-raised hover:text-fg'
              }`}
            >
              <span className="font-bold">Day {i + 1}</span>
              <span>{WEEKDAYS[date.getUTCDay()]}</span>
              <span>
                {MONTHS[date.getUTCMonth()]} {date.getUTCDate()}
              </span>
            </button>
          )
        })}
      </div>
      {actions}
    </div>
  )
}
