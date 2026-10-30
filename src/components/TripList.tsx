import { useDeferredValue, useMemo, useState } from 'react'
import { groupTrips, matchesSearch, type TripGrouping, type TripSort } from '../lib/filters.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { live } from '../lib/travelActions.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { WhoWent } from './WhoWent.tsx'
import { PinGlyph } from './PlacePicker.tsx'

const GROUPINGS: { id: TripGrouping; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'state', label: 'State' },
  { id: 'who', label: 'Who went' },
]
const SORTS: { id: TripSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'title', label: 'Title' },
  { id: 'rating', label: 'Rating' },
]

/**
 * Every trip in a plain list: search, filter (`toolbar`), group and sort (kept in view as the list
 * scrolls on wider screens; the phone's sheet is too short for that). Uses the same filters as the map.
 */
export function TripList({ data, toolbar, onOpenTrip }: { data: TravelData; toolbar?: React.ReactNode; onOpenTrip: (trip: Trip) => void }) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [grouping, setGrouping] = usePersistentState<TripGrouping>('travel.trips.group', 'year', (v) =>
    GROUPINGS.some((g) => g.id === v) ? (v as TripGrouping) : 'year',
  )
  const [sort, setSort] = usePersistentState<TripSort>('travel.trips.sort', 'newest', (v) => (SORTS.some((s) => s.id === v) ? (v as TripSort) : 'newest'))

  const trips = useMemo(() => live(data.trips).filter((t) => matchesSearch(t, data, q)), [data, q])
  const groups = useMemo(() => groupTrips(trips, data, grouping, sort), [trips, data, grouping, sort])

  return (
    <>
      <div className="z-10 -mx-3 -mt-3 flex flex-col gap-2 border-b border-line bg-surface px-3 pt-3 pb-2.5 sm:sticky sm:top-0">
        <label className="relative block">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden>
            <circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            aria-label="Search trips"
            placeholder="Search trips, places, people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-bg pr-3 pl-9 text-base"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {toolbar}
          <Select compact label="Group" name="Group by" value={grouping} options={GROUPINGS} onChange={setGrouping} />
          <Select compact label="Sort" value={sort} options={SORTS} onChange={setSort} />
        </div>
      </div>

      {groups.length === 0 ? (
        <Empty>{live(data.trips).length || query ? 'No trips match.' : 'No trips yet. Add one with “Add trip”.'}</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="mt-4">
            <h3 className="mb-1 flex items-baseline gap-1.5 px-2 text-xs font-bold tracking-wide text-muted uppercase">
              {g.label}
              <span className="font-normal">· {g.trips.length}</span>
            </h3>
            <ul className="flex flex-col">
              {g.trips.map((t) => (
                <TripRow key={t.id} trip={t} data={data} onOpen={() => onOpenTrip(t)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  )
}

function TripRow({ trip, data, onOpen }: { trip: Trip; data: TravelData; onOpen: () => void }) {
  const mains = trip.destinations.filter((d) => d.isMain).map((d) => data.places.find((p) => p.id === d.placeId)).filter((p) => p !== undefined)
  const stops = trip.destinations.length - mains.length
  return (
    // Wider screens: scrolled into view below the search bar that stays at the top, not under it.
    <li className="sm:scroll-mt-28">
      <button onClick={onOpen} className="group flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-raised focus-visible:bg-raised focus-visible:outline-none">
        <PinGlyph park={!!mains[0]?.parkId} className="size-6" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{trip.title}</span>
          <span className="block truncate text-sm text-muted">
            {formatDateRange(trip.startDate, trip.endDate, trip.approximate)}
            {mains.length > 0 && ` · ${mains.map((m) => m.name).join(' & ')}`}
            {stops > 0 && ` · ${stops} ${stops === 1 ? 'stop' : 'stops'}`}
            {trip.rating && ` · ${'★'.repeat(trip.rating)}`}
          </span>
        </span>
        <WhoWent trip={trip} data={data} size={24} max={3} />
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden>
          <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  )
}

/** A labeled dropdown ("Sort Newest"). `compact`: a small chip for toolbars; `name` when the read-out label differs from the shown one. */
export function Select<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string
  name?: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  compact?: boolean
}) {
  return (
    <label className={`flex items-center gap-1 border border-line bg-surface pl-3 text-sm ${compact ? 'h-9 rounded-full' : 'h-11 rounded-lg'}`}>
      <span className="text-muted">{label}</span>
      <select aria-label={name} value={value} onChange={(e) => onChange(e.target.value as T)} className={`h-full bg-transparent pr-2 font-bold ${compact ? 'rounded-full' : 'rounded-lg'}`}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-10 text-center text-muted">{children}</p>
}
