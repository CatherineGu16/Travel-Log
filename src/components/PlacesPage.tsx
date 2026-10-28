import { useDeferredValue, useMemo, useState } from 'react'
import { pinsOf, type Pin } from '../lib/derive.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { regionName } from '../lib/states.ts'
import type { Place, TravelData } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { PinGlyph } from './PlacePicker.tsx'
import { Empty, ListPage, Select } from './TripsPage.tsx'

type PlaceOrder = 'az' | 'state' | 'visits'
const ORDERS: { id: PlaceOrder; label: string }[] = [
  { id: 'az', label: 'A–Z' },
  { id: 'state', label: 'State' },
  { id: 'visits', label: 'Most visited' },
]

/**
 * Your main destinations (the places with pins; stops along the way aren't listed), each with how
 * many times you've been. Opening one shows it on the map, where its trips can be flipped through.
 */
export function PlacesPage({ data, toolbar, onOpenPlace }: { data: TravelData; toolbar: React.ReactNode; onOpenPlace: (place: Place) => void }) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query).trim().toLowerCase()
  const [order, setOrder] = usePersistentState<PlaceOrder>('travel.places.order', 'az', (v) => (ORDERS.some((o) => o.id === v) ? (v as PlaceOrder) : 'az'))
  const where = (p: Place) => regionName(p.regionCode, p.countryCode)

  const rows = useMemo(
    () => pinsOf(data).filter((pin) => !q || `${pin.place.name} ${pin.place.city ?? ''} ${where(pin.place)}`.toLowerCase().includes(q)),
    [data, q],
  )

  const groups = useMemo(() => {
    const byName = (a: Pin, b: Pin) => a.place.name.localeCompare(b.place.name)
    if (order === 'visits') return [{ label: null, rows: [...rows].sort((a, b) => b.trips.length - a.trips.length || byName(a, b)) }]
    if (order === 'az') return [{ label: null, rows: [...rows].sort(byName) }]
    const map = new Map<string, Pin[]>()
    for (const r of rows) map.set(where(r.place), [...(map.get(where(r.place)) ?? []), r])
    return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([label, rs]) => ({ label, rows: rs.sort(byName) }))
  }, [rows, order])

  return (
    <ListPage title="Places" count={`${rows.length} ${rows.length === 1 ? 'place' : 'places'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search places"
          placeholder="Search places, states or countries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-0 flex-1 basis-56 rounded-lg border border-line bg-surface px-3 text-base"
        />
        {toolbar}
        <Select label="Order" value={order} options={ORDERS} onChange={setOrder} />
      </div>
      {rows.length === 0 ? (
        <Empty>{query ? 'No places match.' : 'Your main destinations appear here once you add trips.'}</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.label ?? 'all'} aria-label={g.label ?? 'Places'} className="mt-6">
            {g.label && <h2 className="mb-2 font-display text-xl font-semibold">{g.label}</h2>}
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {g.rows.map((pin) => (
                <PlaceRow key={pin.place.id} pin={pin} where={where(pin.place)} onOpen={() => onOpenPlace(pin.place)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </ListPage>
  )
}

function PlaceRow({ pin, where, onOpen }: { pin: Pin; where: string; onOpen: () => void }) {
  const latest = pin.trips[0]
  const here = latest.destinations.find((d) => d.placeId === pin.place.id)
  const last = here?.startDate ? formatDateRange(here.startDate, here.endDate) : formatDateRange(latest.startDate, latest.endDate, latest.approximate)
  return (
    <li aria-label={pin.place.name}>
      <button onClick={onOpen} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-raised">
        <PinGlyph park={pin.isPark} className="size-6" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{pin.place.name}</span>
          <span className="block truncate text-sm text-muted">
            {where} · {pin.trips.length === 1 ? last : `${pin.trips.length} visits, latest ${last}`}
          </span>
        </span>
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" aria-hidden>
          <path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  )
}
