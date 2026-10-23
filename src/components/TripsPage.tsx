import { useDeferredValue, useMemo, useState } from 'react'
import { groupTrips, matchesSearch, type TripGrouping, type TripSort } from '../lib/filters.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { live } from '../lib/travelActions.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { AvatarStack } from './Avatar.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { TravelModeBadge, TripTypeBadge } from './TravelMode.tsx'

const GROUPINGS: { id: TripGrouping; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'state', label: 'State' },
  { id: 'type', label: 'Type of trip' },
]
const SORTS: { id: TripSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'title', label: 'Title' },
  { id: 'rating', label: 'Rating' },
]

/** Every trip in a plain list: search, group, sort. Uses the same filters as the map. */
export function TripsPage({ data, toolbar, onOpenTrip }: { data: TravelData; toolbar: React.ReactNode; onOpenTrip: (trip: Trip) => void }) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [grouping, setGrouping] = usePersistentState<TripGrouping>('travel.trips.group', 'year', (v) =>
    GROUPINGS.some((g) => g.id === v) ? (v as TripGrouping) : 'year',
  )
  const [sort, setSort] = usePersistentState<TripSort>('travel.trips.sort', 'newest', (v) => (SORTS.some((s) => s.id === v) ? (v as TripSort) : 'newest'))

  const trips = useMemo(() => live(data.trips).filter((t) => matchesSearch(t, data, q)), [data, q])
  const groups = useMemo(() => groupTrips(trips, data, grouping, sort), [trips, data, grouping, sort])

  return (
    <ListPage title="Trips" count={`${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search trips"
          placeholder="Search trips, places, people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-0 flex-1 basis-56 rounded-lg border border-line bg-surface px-3 text-base"
        />
        {toolbar}
        <Select label="Group by" value={grouping} options={GROUPINGS} onChange={setGrouping} />
        <Select label="Sort" value={sort} options={SORTS} onChange={setSort} />
      </div>

      {groups.length === 0 ? (
        <Empty>{live(data.trips).length || query ? 'No trips match.' : 'No trips yet. Add one with “Add trip”.'}</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="mt-6">
            <h2 className="mb-2 flex items-baseline gap-2 font-display text-xl font-semibold">
              {g.label}
              <span className="text-sm font-normal text-muted">{g.trips.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {g.trips.map((t) => (
                <TripRow key={t.id} trip={t} data={data} onOpen={() => onOpenTrip(t)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </ListPage>
  )
}

function TripRow({ trip, data, onOpen }: { trip: Trip; data: TravelData; onOpen: () => void }) {
  const mains = trip.destinations.filter((d) => d.isMain).map((d) => data.places.find((p) => p.id === d.placeId)).filter((p) => p !== undefined)
  const stops = trip.destinations.length - mains.length
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)
  return (
    <li>
      <button onClick={onOpen} className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-raised">
        <PinGlyph park={!!mains[0]?.parkId} className="size-6" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-bold">{trip.title}</span>
            <TripTypeBadge type={trip.tripType} />
            <TravelModeBadge mode={trip.travelMode} />
          </span>
          <span className="block truncate text-sm text-muted">
            {formatDateRange(trip.startDate, trip.endDate, trip.approximate)}
            {mains.length > 0 && ` · ${mains.map((m) => m.name).join(' & ')}`}
            {stops > 0 && ` · ${stops} ${stops === 1 ? 'stop' : 'stops'}`}
            {trip.rating && ` · ${'★'.repeat(trip.rating)}`}
          </span>
        </span>
        <AvatarStack people={people} size={24} max={3} />
      </button>
    </li>
  )
}

export function ListPage({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-3 pt-[calc(max(0.75rem,env(safe-area-inset-top))+4.5rem)] pb-10 sm:px-6">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="font-display text-[2rem] leading-none font-semibold">{title}</h1>
        <span className="text-sm text-muted">{count}</span>
      </div>
      {children}
    </div>
  )
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="flex h-11 items-center gap-1.5 rounded-lg border border-line bg-surface pl-3 text-sm">
      <span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="h-full rounded-lg bg-transparent pr-2 font-bold">
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
