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
 * day you arrived, then the day you left (or the same day again). It opens on the day the stop
 * before ended. Otherwise, or for days outside the trip, the calendar. Either way taps only change
 * what's shown: Done keeps the dates, Cancel leaves them as they were; Clear takes them off.
 */
export function StopDates({
  place,
  tripStart,
  tripEnd,
  start: savedStart,
  end: savedEnd,
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
  /** Closes it (after Done, Cancel or Clear). */
  onDone: () => void
}) {
  // The days as you pick them on the strip, kept until Done.
  const [[start, end], setDraft] = useState<[PartialDate | null, PartialDate | null]>([savedStart, savedEnd])
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

  const clear = savedStart !== null && (
    <button
      type="button"
      aria-label={`Clear the dates at ${place}`}
      onClick={() => {
        onChange(null, null)
        onDone()
      }}
      className="min-h-11 rounded-lg px-2 text-sm text-muted hover:bg-raised hover:text-fg"
    >
      Clear
    </button>
  )

  // The calendar has its own Cancel and Done.
  if (calendar)
    return (
      <div className="flex flex-col gap-1 border-t border-line p-2">
        <DateRangeField
          defaultOpen
          label={`Dates at ${place}`}
          start={start ?? suggested ?? tripStart}
          end={end ?? start ?? suggested ?? tripStart}
          onChange={(s, e) => onChange(s, e === s ? null : e)}
          onClose={onDone}
          extraAction={clear}
        />
      </div>
    )

  const days = Array.from({ length: length! }, (_, i) => addDays(tripStart, i))
  const last = end ?? start
  const tap = (day: PartialDate) => {
    if (picking === 'first' || !start) {
      setDraft([day, null])
      setPicking('last')
      return
    }
    const [a, b] = comparePartialDates(day, start) < 0 ? [day, start] : [start, day]
    setDraft([a, a === b ? null : b])
    setPicking('first')
  }
  const done = () => {
    if (start !== savedStart || end !== savedEnd) onChange(start, end)
    onDone()
  }
  return (
    <div className="flex flex-col gap-1 border-t border-line p-2" role="group" aria-label={`Days at ${place}`}>
      <p className="px-1 text-xs text-muted">
        {picking === 'last' && start
          ? 'Now the day you left (or the same day again).'
          : start && start !== savedStart
            ? 'Done keeps these days; tap another day to start over.'
            : 'Tap the day you got here.'}
      </p>
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
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {clear}
        <button type="button" onClick={() => setCalendar(true)} className="min-h-11 rounded-lg px-2 text-muted hover:bg-raised hover:text-fg">
          Other dates…
        </button>
        <button type="button" aria-label={`Cancel the dates at ${place}`} onClick={onDone} className="ml-auto min-h-11 rounded-lg px-3 font-bold text-muted hover:bg-raised hover:text-fg">
          Cancel
        </button>
        <button type="button" aria-label={`Done with the dates at ${place}`} onClick={done} className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary">
          Done
        </button>
      </div>
    </div>
  )
}
