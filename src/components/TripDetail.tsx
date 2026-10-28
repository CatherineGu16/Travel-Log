import { visitsTo } from '../lib/derive.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { Avatar } from './Avatar.tsx'
import { GroupIcon } from './PeoplePicker.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { Sheet } from './Sheet.tsx'

/**
 * Everything about one trip, the whole screen on a phone (pull the top down to close): who went,
 * the stops in order (each with its own dates, note, and every other time you've been there), then
 * the trip's notes: hikes, description, highlights, rating and tags.
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
  // Every destination in order, with its stop number when it isn't a main destination.
  let n = 0
  const stops = trip.destinations.flatMap((d) => {
    const p = place(d.placeId)
    return p ? [{ place: p, destination: d, number: d.isMain ? null : ++n }] : []
  })
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)
  const tagged = data.groups.filter((g) => !g.deleted && trip.companionGroupIds.includes(g.id))
  const hikesByPark = [...new Set(trip.hikes.map((h) => h.parkId))].map((parkId) => ({
    park: PARKS.find((p) => p.id === parkId)?.name ?? parkId,
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
      description={formatDateRange(trip.startDate, trip.endDate, trip.approximate)}
      footer={
        <div className="flex justify-end">
          <button onClick={() => onEdit(trip)} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary">
            Edit trip
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {(people.length > 0 || tagged.length > 0) && (
          <section>
            <h3 className="mb-2 text-sm font-bold text-muted">Who went</h3>
            <ul className="flex flex-wrap gap-2">
              {tagged.map((g) => (
                <li key={g.id} className="flex items-center gap-1.5 rounded-full bg-raised py-1.5 pr-3 pl-2.5 text-sm font-bold">
                  <GroupIcon />
                  {g.name}
                </li>
              ))}
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
          <h3 className="mb-2 text-sm font-bold text-muted">{stops.length > 1 ? 'Stops' : 'Where'}</h3>
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
                    {stop.startDate && <div className="text-sm text-muted">{formatDateRange(stop.startDate, stop.endDate)}</div>}
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

        {hasNotes && (
          <section aria-label="Notes" className="flex flex-col gap-4 border-t border-line pt-5">
            {hikesByPark.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-muted">Hikes</h3>
                {hikesByPark.map(({ park, hikes }) => (
                  <div key={park} className="mb-1">
                    {hikesByPark.length > 1 && <div className="text-xs text-muted">{park}</div>}
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
                    <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-sm">
                      {t}
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
