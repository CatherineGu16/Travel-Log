import { useDeferredValue, useMemo, useState } from 'react'
import { visitsTo, type Visit } from '../lib/derive.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { regionName } from '../lib/states.ts'
import { live } from '../lib/travelActions.ts'
import type { Place, TravelData, Trip } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { PinGlyph } from './PlacePicker.tsx'
import { Empty, ListPage, Select } from './TripsPage.tsx'

type PlaceOrder = 'az' | 'state' | 'visits'
const ORDERS: { id: PlaceOrder; label: string }[] = [
  { id: 'az', label: 'A–Z' },
  { id: 'state', label: 'State' },
  { id: 'visits', label: 'Most visited' },
]

/** Every place you've been, as a main destination or a stop, with every visit's dates stacked. */
export function PlacesPage({ data, toolbar, onOpenTrip }: { data: TravelData; toolbar: React.ReactNode; onOpenTrip: (trip: Trip) => void }) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query).trim().toLowerCase()
  const [order, setOrder] = usePersistentState<PlaceOrder>('travel.places.order', 'az', (v) => (ORDERS.some((o) => o.id === v) ? (v as PlaceOrder) : 'az'))

  const rows = useMemo(
    () =>
      live(data.places)
        .map((place) => ({ place, visits: visitsTo(data, place.id) }))
        .filter((r) => r.visits.length > 0)
        .filter((r) => !q || `${r.place.name} ${r.place.city ?? ''} ${regionName(r.place.regionCode, r.place.countryCode)}`.toLowerCase().includes(q)),
    [data, q],
  )

  const groups = useMemo(() => {
    const byName = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.place.name.localeCompare(b.place.name)
    if (order === 'visits') return [{ label: null, rows: [...rows].sort((a, b) => b.visits.length - a.visits.length || byName(a, b)) }]
    if (order === 'az') return [{ label: null, rows: [...rows].sort(byName) }]
    const map = new Map<string, typeof rows>()
    for (const r of rows) {
      const name = regionName(r.place.regionCode, r.place.countryCode)
      map.set(name, [...(map.get(name) ?? []), r])
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([label, rs]) => ({ label, rows: rs.sort(byName) }))
  }, [rows, order])

  return (
    <ListPage title="Places" count={`${rows.length} ${rows.length === 1 ? 'place' : 'places'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search places"
          placeholder="Search places or states"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-0 flex-1 basis-56 rounded-lg border border-line bg-surface px-3 text-base"
        />
        {toolbar}
        <Select label="Order" value={order} options={ORDERS} onChange={setOrder} />
      </div>
      {rows.length === 0 ? (
        <Empty>{query ? 'No places match.' : 'Places appear here once you add trips.'}</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.label ?? 'all'} aria-label={g.label ?? 'Places'} className="mt-6">
            {g.label && <h2 className="mb-2 font-display text-xl font-semibold">{g.label}</h2>}
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {g.rows.map((r) => (
                <PlaceRow key={r.place.id} place={r.place} visits={r.visits} onOpenTrip={onOpenTrip} />
              ))}
            </ul>
          </section>
        ))
      )}
    </ListPage>
  )
}

function PlaceRow({ place, visits, onOpenTrip }: { place: Place; visits: Visit[]; onOpenTrip: (trip: Trip) => void }) {
  return (
    <li className="flex gap-3 px-3 py-3" aria-label={place.name}>
      <PinGlyph park={!!place.parkId} className="mt-0.5 size-6" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-bold">{place.name}</span>
          <span className="shrink-0 text-sm text-muted">
            {place.regionCode?.replace(/^US-/, '')} · {visits.length === 1 ? '1 visit' : `${visits.length} visits`}
          </span>
        </div>
        {/* Stacked dates: every visit, newest first; each opens its trip on the map. */}
        <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Visits to ${place.name}`}>
          {visits.map((v) => (
            <li key={v.trip.id}>
              <button onClick={() => onOpenTrip(v.trip)} title={v.trip.title} className="min-h-8 rounded-full bg-raised px-2.5 text-sm hover:bg-line">
                <span className="font-bold">{formatDateRange(v.startDate, v.endDate, v.approximate)}</span>
                <span className="ml-1.5 text-muted">{v.trip.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}
