import { useMemo } from 'react'
import { hasStarted, hikesDone, parkVisits } from '../lib/derive.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { comparePartialDates, formatPartialDate, todayIso, yearOf } from '../lib/partialDate.ts'
import { regionName } from '../lib/states.ts'
import type { TravelData } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { ParkBadge } from './ParkBadge.tsx'
import { Empty, Select } from './TripList.tsx'

export type ParkShow = 'all' | 'visited' | 'not-visited'
type ParkOrder = 'az' | 'state' | 'recent'

const SHOWS: { id: ParkShow; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'visited', label: 'Visited' },
  { id: 'not-visited', label: 'Not visited' },
]

/**
 * You › Parks: all 64 national parks as a grid of badges, like Apple Watch awards: in color once
 * you've been (on a trip that has started), outlined until then. Tapping one opens the park.
 */
export function ParksSection({ data, onOpenPark }: { data: TravelData; onOpenPark: (parkId: string) => void }) {
  const [show, setShow] = usePersistentState<ParkShow>('travel.parks.show', 'all', (v) => (SHOWS.some((s) => s.id === v) ? (v as ParkShow) : 'all'))
  const [order, setOrder] = usePersistentState<ParkOrder>('travel.parks.order', 'az', (v) => (v === 'state' || v === 'recent' ? v : 'az'))
  const rows = useMemo(() => {
    const today = todayIso()
    return PARKS.map((park) => {
      const visits = parkVisits(data, park.id)
      // Newest first; a trip dated in the future isn't a visit until it starts.
      const been = visits.filter((v) => hasStarted(v.startDate, today))
      const upcoming = visits.filter((v) => !hasStarted(v.startDate, today)).at(-1) ?? null
      return { park, been, upcoming, hikesDone: hikesDone(data, park.id).size }
    })
  }, [data])
  const visitedCount = rows.filter((r) => r.been.length > 0).length
  const shown = rows.filter((r) => show === 'all' || (show === 'visited') === r.been.length > 0)
  // Recent: newest visit first, then the parks you haven't been to, A–Z.
  const recent = (list: typeof shown) =>
    [...list].sort((a, b) => (b.been.length > 0 ? 1 : 0) - (a.been.length > 0 ? 1 : 0) || comparePartialDates(b.been[0]?.startDate ?? '', a.been[0]?.startDate ?? '') || a.park.name.localeCompare(b.park.name))

  const groups =
    order === 'state'
      ? [...new Set(shown.flatMap((r) => r.park.states))]
          .map((code) => ({ label: regionName(code) as string | null, rows: shown.filter((r) => r.park.states.includes(code)) }))
          .sort((a, b) => a.label!.localeCompare(b.label!))
      : [{ label: null as string | null, rows: order === 'recent' ? recent(shown) : shown }]

  return (
    <section aria-label="National parks">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-2xl font-semibold">National parks</h2>
        <span className="text-sm text-muted">
          {visitedCount} / {PARKS.length} visited
        </span>
      </div>
      <div
        className="mb-4 h-2 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-label="Parks visited"
        aria-valuenow={visitedCount}
        aria-valuemax={PARKS.length}
      >
        <div className="h-full rounded-full bg-park" style={{ width: `${(visitedCount / PARKS.length) * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Show" className="flex rounded-lg border border-line bg-surface p-0.5">
          {SHOWS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={show === s.id}
              onClick={() => setShow(s.id)}
              className={`min-h-10 rounded-md px-3 text-sm ${show === s.id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Select
          label="Order"
          value={order}
          options={[
            { id: 'az', label: 'A–Z' },
            { id: 'state', label: 'State' },
            { id: 'recent', label: 'Recent' },
          ]}
          onChange={setOrder}
        />
      </div>

      {shown.length === 0 ? (
        <Empty>{show === 'visited' ? 'No parks visited yet.' : 'You’ve been to every park!'}</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.label ?? 'all'} aria-label={g.label ?? 'Parks'} className="mt-6">
            {g.label && <h3 className="mb-2 font-display text-xl font-semibold">{g.label}</h3>}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-1 gap-y-2">
              {g.rows.map(({ park, been, upcoming, hikesDone: hd }) => {
                const times = been.length
                const status = times ? `visited ${times === 1 ? 'once' : `${times} times`}` : upcoming ? `upcoming, ${formatPartialDate(upcoming.startDate)}` : 'not visited'
                // Under the name: the year you were last there and your hikes, or when you're going.
                const line = times ? [yearOf(been[0].startDate), hd > 0 && `${hd} ${hd === 1 ? 'hike' : 'hikes'}`].filter(Boolean).join(' · ') : upcoming ? `Upcoming · ${formatPartialDate(upcoming.startDate)}` : ''
                return (
                  <li key={park.id} aria-label={park.name}>
                    <button
                      onClick={() => onOpenPark(park.id)}
                      aria-label={`${park.name}, ${status}`}
                      className="flex w-full flex-col items-center gap-1 rounded-2xl px-1 pt-2.5 pb-2 text-center hover:bg-raised focus-visible:bg-raised"
                    >
                      <span className="relative">
                        <ParkBadge parkId={park.id} name={park.name} earned={times > 0} size={84} />
                        {times > 1 && (
                          <span className="absolute -top-0.5 -right-1 rounded-full bg-park px-1.5 text-xs leading-5 font-bold text-white ring-2 ring-bg">×{times}</span>
                        )}
                      </span>
                      <span className={`text-sm leading-tight font-bold ${times ? '' : 'text-muted'}`}>{park.name}</span>
                      {line && <span className="text-xs leading-tight text-muted">{line}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </section>
  )
}
