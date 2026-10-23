import type { Pin } from '../lib/derive.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { deleteTrip } from '../lib/travelActions.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import { AvatarStack } from './Avatar.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { useToast } from './toastContext.ts'

/**
 * The preview card for a selected pin: the place, and every trip there with its dates stacked,
 * newest first. A floating card over the map, not a modal, so the map stays usable.
 */
export function PinCard({ pin, data, onEdit, onClose }: { pin: Pin; data: TravelData; onEdit: (trip: Trip) => void; onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const placeName = (id: string) => data.places.find((p) => p.id === id)?.name ?? 'Unknown place'

  const remove = (trip: Trip) => {
    const undoId = store.apply((d, c) => deleteTrip(d, c, trip.id), `Deleted ${trip.title}`)
    if (undoId !== null) toast(`Deleted ${trip.title}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
  }

  return (
    <section
      aria-label={`${pin.place.name} trips`}
      className="pointer-events-auto flex max-h-[min(60dvh,32rem)] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgb(0_0_0/0.25)] sm:w-96"
    >
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <PinGlyph park={pin.isPark} className="mt-1 size-5" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-semibold">{pin.place.name}</h2>
          <p className="text-sm text-muted">
            {pin.trips.length === 1 ? '1 visit' : `${pin.trips.length} visits`}
            {pin.place.regionCode && ` · ${pin.place.regionCode.replace(/^US-/, '')}`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {pin.trips.map((trip) => {
          const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)
          return (
            <li key={trip.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h3 className="min-w-0 flex-1 truncate font-bold">{trip.title}</h3>
                {trip.isFamily && <span className="shrink-0 rounded-full bg-park/15 px-2 py-0.5 text-xs font-bold text-park">Family</span>}
              </div>
              <p className="text-sm text-muted">{formatDateRange(trip.startDate, trip.endDate, trip.approximate)}</p>
              {trip.stops.length > 0 && (
                <p className="mt-1 text-sm">
                  <span className="text-muted">Stops: </span>
                  {trip.stops.map((s) => placeName(s.placeId)).join(' → ')}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <AvatarStack people={people} />
                <span className="ml-auto" />
                <button onClick={() => onEdit(trip)} className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
                  Edit
                </button>
                <button onClick={() => remove(trip)} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-raised hover:text-danger">
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
