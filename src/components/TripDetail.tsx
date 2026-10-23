import { visitsTo } from '../lib/derive.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { routeOf } from '../lib/route.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { Avatar } from './Avatar.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'

/**
 * Everything about one trip: dates, who went, the route stop by stop (each with its own dates,
 * note, and every other time you've been there), and your notes.
 */
export function TripDetail({
  trip,
  data,
  onOpenTrip,
  onEdit,
  onClose,
}: {
  trip: Trip
  data: TravelData
  onOpenTrip: (trip: Trip) => void
  onEdit: (trip: Trip) => void
  onClose: () => void
}) {
  const place = (id: string) => data.places.find((p) => p.id === id)
  const main = place(trip.mainPlaceId)
  const route = routeOf(trip, data.places)
  const stops = route.length ? route.map((r) => r.place) : main ? [main] : []
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={trip.title}
      accent="var(--primary)"
      description={
        <span className="flex flex-wrap items-center gap-2">
          {formatDateRange(trip.startDate, trip.endDate, trip.approximate)}
          {trip.isFamily && <span className="rounded-full bg-park/15 px-2 py-0.5 text-xs font-bold text-park">Family</span>}
          {trip.rating && (
            <span className="text-[#e0a526]" aria-label={`${trip.rating} out of 5 stars`}>
              {'★'.repeat(trip.rating)}
            </span>
          )}
        </span>
      }
      footer={
        <div className="flex justify-end">
          <button onClick={() => onEdit(trip)} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary">
            Edit trip
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {people.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-bold text-muted">Who went</h3>
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
          <h3 className="mb-2 text-sm font-bold text-muted">{route.length ? 'Route' : 'Where'}</h3>
          <ol className="relative flex flex-col">
            {stops.map((p, i) => {
              const r = route[i]
              const stop = trip.stops.find((s) => s.placeId === p.id)
              const others = visitsTo(data, p.id).filter((v) => v.trip.id !== trip.id)
              const isMain = p.id === trip.mainPlaceId
              return (
                <li key={p.id + i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < stops.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[0.69rem] border-l-2 border-dotted border-[var(--route)]" />}
                  {isMain ? (
                    <PinGlyph park={!!p.parkId} className="size-6" />
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--route)] text-xs font-bold text-[var(--route-text)]">{r?.number}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {p.name}
                      {isMain && <span className="ml-2 text-xs font-normal text-muted">Main destination</span>}
                    </div>
                    {stop?.startDate && <div className="text-sm text-muted">{formatDateRange(stop.startDate, stop.endDate)}</div>}
                    {stop?.note && <div className="text-sm">{stop.note}</div>}
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

        {(trip.description || trip.highlights) && (
          <section className="flex flex-col gap-3">
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
          </section>
        )}

        {trip.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {trip.tags.map((t) => (
              <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-sm">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
