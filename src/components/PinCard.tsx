import { useMemo, useState } from 'react'
import type { Pin } from '../lib/derive.ts'
import { legMemory } from '../lib/legs.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { routeOf } from '../lib/route.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { PRESSABLE_CARD } from './cards.ts'
import { PinGlyph } from './PlacePicker.tsx'
import { WhoWent } from './WhoWent.tsx'

// Where the pointer last was. A browser also tells a card the pointer moved onto it when the card
// appears under a resting pointer (as the list opens), at that same spot; that isn't pointing at it.
let pointerAt: string | null = null
if (typeof window !== 'undefined')
  for (const type of ['pointermove', 'pointerdown'] as const)
    window.addEventListener(type, (e) => (pointerAt = `${e.clientX},${e.clientY}`), { capture: true, passive: true })

/**
 * A place's trips (its pin), filling the Trips panel or sheet (Trips › Moab): a card per visit,
 * newest first (one card when you've been once). Moving the pointer onto a card (or focusing it)
 * draws its route on the map; tapping it opens the trip with all its details.
 */
export function PinCard({
  pin,
  trip,
  data,
  onPreview,
  onOpen,
  onMovePin,
}: {
  pin: Pin
  /** The visit whose route the map shows. */
  trip: Trip
  data: TravelData
  onPreview: (tripId: string) => void
  onOpen: (trip: Trip) => void
  /** Move this place's pin (it's in the wrong spot). */
  onMovePin?: () => void
}) {
  // Where the pointer was resting when the cards appeared.
  const [restingAt] = useState(() => pointerAt)
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
                // Only when the pointer really moves onto it, not when the card appears under it.
                onPointerMove={(e) => !shown && `${e.clientX},${e.clientY}` !== restingAt && onPreview(t.id)}
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
      {onMovePin && (
        <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-1 text-sm text-muted">
          <span className="min-w-0 flex-1">Pin in the wrong spot?</span>
          <button
            onClick={onMovePin}
            aria-label={`Move the ${pin.place.name} pin`}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 font-bold text-primary hover:bg-raised"
          >
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
              <path d="M10 2v16M2 10h16M10 2 7.5 4.5M10 2l2.5 2.5M10 18l-2.5-2.5M10 18l2.5-2.5M2 10l2.5-2.5M2 10l2.5 2.5M18 10l-2.5-2.5M18 10l-2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Move pin
          </button>
        </div>
      )}
    </section>
  )
}
