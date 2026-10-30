import { useMemo } from 'react'
import type { Pin } from '../lib/derive.ts'
import { legMemory } from '../lib/legs.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { routeOf } from '../lib/route.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { PRESSABLE_CARD } from './cards.ts'
import { PinGlyph } from './PlacePicker.tsx'
import { WhoWent } from './WhoWent.tsx'

/**
 * A place's trips (a pin visited more than once), filling the Trips panel or sheet (Trips › Moab):
 * a card per visit, newest first. Pointing at a card (or focusing it) draws its route on the map;
 * tapping it opens the trip with all its details.
 */
export function PinCard({
  pin,
  trip,
  data,
  onPreview,
  onOpen,
}: {
  pin: Pin
  /** The visit whose route the map shows. */
  trip: Trip
  data: TravelData
  onPreview: (tripId: string) => void
  onOpen: (trip: Trip) => void
}) {
  const routes = useMemo(() => {
    const memory = legMemory(data)
    return new Map(pin.trips.map((t) => [t.id, routeOf(t, data.places, { home: data.home, memory })]))
  }, [pin.trips, data])

  return (
    <section aria-label={`${pin.place.name} trips`} className="flex min-h-0 flex-1 flex-col">
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {pin.trips.map((t) => {
          const shown = t.id === trip.id
          // Just the places you went, in order: how you traveled and the way from home are on the map.
          const places = (routes.get(t.id) ?? []).filter((r) => r.role !== 'home')
          const here = t.destinations.find((d) => d.placeId === pin.place.id)
          return (
            <li key={t.id}>
              <button
                onClick={() => onOpen(t)}
                onMouseEnter={() => onPreview(t.id)}
                onFocus={() => onPreview(t.id)}
                aria-label={`${t.title}, ${formatDateRange(t.startDate, t.endDate, t.approximate)}`}
                className={`${PRESSABLE_CARD} flex w-full items-start gap-3 p-3 ${shown ? 'border-primary/60' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-bold">{t.title}</span>
                    {shown && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">On the map</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {here?.startDate ? formatDateRange(here.startDate, here.endDate) : formatDateRange(t.startDate, t.endDate, t.approximate)}
                  </span>
                  {places.length > 1 && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                      {places.map((r, i) => (
                        <span key={r.place.id + i} className="flex items-center gap-1.5">
                          {i > 0 && (
                            <span aria-hidden className="text-muted">
                              ›
                            </span>
                          )}
                          {r.number === null ? (
                            <PinGlyph park={!!r.place.parkId} className="size-4" />
                          ) : (
                            <span className="grid size-5 place-items-center rounded-full bg-[var(--route)] text-[0.7rem] font-bold text-[var(--route-text)]">{r.number}</span>
                          )}
                          <span className={r.role === 'main' ? 'font-bold' : ''}>{r.place.name}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="mt-2 block">
                    <WhoWent trip={t} data={data} />
                  </span>
                </span>
                <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden>
                  <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
