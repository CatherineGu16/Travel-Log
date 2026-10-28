import { lazy, Suspense, useMemo } from 'react'
import { visitsTo } from '../lib/derive.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { formatDistance, legMemory } from '../lib/legs.ts'
import { dayLabel, formatDateRange, tripDays } from '../lib/partialDate.ts'
import { distancesByMode, routeOf } from '../lib/route.ts'
import { deleteTrip } from '../lib/travelActions.ts'
import type { LegMode, TravelData, Trip } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import { Avatar } from './Avatar.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './toastContext.ts'

// MapLibre is its own chunk; the small map loads with it.
const RouteMap = lazy(() => import('../map/RouteMap.tsx'))

/** "820 mi driven": how far each way of traveling went, biggest first. */
const MODE_WORDS: Record<LegMode, string> = { drive: 'driven', flight: 'flown', train: 'by train', cruise: 'cruising', boat: 'by boat', walk: 'walked', unknown: '' }

export type TripStep = 'Details' | 'Route' | 'Notes'

/**
 * Everything about one trip, the whole screen on a phone (pull the top down to close): a small map
 * of the route, how long and how far, who went, the stops in order (each with its day of the trip,
 * dates, note, and every other time you've been there), then the trip's notes: hikes,
 * description, highlights, rating and tags. Each part's Edit opens the trip on that step.
 */
export function TripDetail({
  trip,
  data,
  onOpenTrip,
  onEdit,
  onTag,
  onOpenPark,
  onClose,
}: {
  trip: Trip
  data: TravelData
  onOpenTrip: (trip: Trip) => void
  onEdit: (trip: Trip, step?: TripStep) => void
  /** Show your trips with this tag. */
  onTag: (tag: string) => void
  onOpenPark: (parkId: string) => void
  onClose: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const route = useMemo(() => routeOf(trip, data.places, { home: data.home, memory: legMemory(data) }), [trip, data])
  const days = tripDays(trip.startDate, trip.endDate)
  const distances = Object.entries(distancesByMode(route))
    .filter(([mode, m]) => mode !== 'unknown' && m >= 1609)
    .sort((a, b) => b[1] - a[1])
    .map(([mode, m]) => `~${formatDistance(m)} ${MODE_WORDS[mode as LegMode]}`)
  const summary = [formatDateRange(trip.startDate, trip.endDate, trip.approximate), days && (days === 1 ? '1 day' : `${days} days`), ...distances].filter(Boolean).join(' · ')
  const remove = () => {
    const undoId = store.apply((d, c) => deleteTrip(d, c, trip.id), `Deleted ${trip.title}`)
    if (undoId === null) return
    onClose()
    toast(`Deleted ${trip.title}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
  }
  const editLink = (step: TripStep, what: string) => (
    <button onClick={() => onEdit(trip, step)} aria-label={`Edit ${what}`} className="-my-1 min-h-9 rounded-lg px-2 text-sm font-bold text-primary hover:bg-raised">
      Edit
    </button>
  )
  const heading = (text: string, step: TripStep, what: string) => (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-bold text-muted">{text}</h3>
      {editLink(step, what)}
    </div>
  )
  const place = (id: string) => data.places.find((p) => p.id === id)
  // Every destination in order, with its stop number when it isn't a main destination.
  let n = 0
  const stops = trip.destinations.flatMap((d) => {
    const p = place(d.placeId)
    return p ? [{ place: p, destination: d, number: d.isMain ? null : ++n }] : []
  })
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)
  const hikesByPark = [...new Set(trip.hikes.map((h) => h.parkId))].map((parkId) => ({
    parkId,
    park: PARKS.find((p) => p.id === parkId)?.fullName ?? parkId,
    hikes: trip.hikes.filter((h) => h.parkId === parkId),
  }))
  const hasNotes = trip.hikes.length > 0 || trip.description || trip.highlights || trip.rating || trip.tags.length > 0

  return (
    <Sheet
      open
      full
      swipeToClose
      onOpenChange={(open) => !open && onClose()}
      title={trip.title}
      accent="var(--primary)"
      description={summary}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button onClick={remove} className="min-h-11 rounded-lg px-3 text-muted hover:bg-raised hover:text-danger">
            Delete
          </button>
          <button onClick={() => onEdit(trip)} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary">
            Edit trip
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {route.length > 1 && (
          <Suspense fallback={<div className="h-44 rounded-xl border border-line bg-raised" />}>
            <RouteMap route={route} label={`Map of the route: ${route.map((r) => r.place.name).join(', ')}`} />
          </Suspense>
        )}
        {people.length > 0 && (
          <section>
            {heading('Who went', 'Details', 'who went')}
            <ul className="flex flex-wrap gap-2">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-raised py-1 pr-3 pl-1 text-sm">
                  <Avatar person={p} size={26} />
                  {p.deleted ? 'Someone removed' : p.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          {heading(stops.length > 1 ? 'Stops' : 'Where', 'Route', 'the stops')}
          <ol className="relative flex flex-col">
            {stops.map(({ place: p, destination: stop, number }, i) => {
              const others = visitsTo(data, p.id).filter((v) => v.trip.id !== trip.id)
              return (
                <li key={p.id + i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < stops.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[0.69rem] border-l-2 border-dotted border-line" />}
                  {stop.isMain ? (
                    <PinGlyph park={!!p.parkId} className="size-6" />
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--route)] text-xs font-bold text-[var(--route-text)]">{number}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {p.name}
                      {stop.isMain && <span className="ml-2 text-xs font-normal text-muted">Main destination</span>}
                    </div>
                    {stop.startDate && (
                      <div className="text-sm text-muted">
                        {[dayLabel(trip.startDate, stop.startDate, stop.endDate), formatDateRange(stop.startDate, stop.endDate)].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {stop.note && <div className="text-sm">{stop.note}</div>}
                    {others.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                        Also here:
                        {others.map((v) => (
                          <button
                            key={v.trip.id}
                            onClick={() => onOpenTrip(v.trip)}
                            className="min-h-7 rounded-full bg-raised px-2 font-bold text-fg hover:bg-line"
                            title={v.trip.title}
                          >
                            {formatDateRange(v.startDate, v.endDate, v.approximate)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {!hasNotes && (
          <button onClick={() => onEdit(trip, 'Notes')} className="min-h-11 rounded-lg border border-dashed border-line text-sm font-bold text-primary hover:bg-raised">
            Add notes, a rating or tags
          </button>
        )}
        {hasNotes && (
          <section aria-label="Notes" className="flex flex-col gap-4 border-t border-line pt-5">
            <div className="-mb-2 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">Notes</h3>
              {editLink('Notes', 'the notes')}
            </div>
            {hikesByPark.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-muted">Hikes</h3>
                {hikesByPark.map(({ parkId, park, hikes }) => (
                  <div key={parkId} className="mb-1">
                    <button onClick={() => onOpenPark(parkId)} className="text-xs font-bold text-park hover:underline">
                      {park}
                    </button>
                    <ul className="text-sm">
                      {hikes.map((h) => (
                        <li key={h.hikeId ?? h.name}>
                          {h.name}
                          {h.date && <span className="ml-1.5 text-muted">{formatDateRange(h.date, null)}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {trip.description && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-muted">Description</h3>
                <p className="whitespace-pre-line">{trip.description}</p>
              </div>
            )}
            {trip.highlights && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-muted">Highlights</h3>
                <p className="whitespace-pre-line">{trip.highlights}</p>
              </div>
            )}
            {trip.rating && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-muted">Rating</h3>
                <span role="img" className="text-lg text-[#e0a526]" aria-label={`${trip.rating} out of 5 stars`}>
                  {'★'.repeat(trip.rating)}
                  <span className="text-line">{'★'.repeat(5 - trip.rating)}</span>
                </span>
              </div>
            )}
            {trip.tags.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-muted">Tags</h3>
                <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                  {trip.tags.map((t) => (
                    <li key={t}>
                      <button onClick={() => onTag(t)} aria-label={`Show trips tagged ${t}`} className="min-h-8 rounded-full border border-line px-2.5 text-sm hover:bg-raised">
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </Sheet>
  )
}
