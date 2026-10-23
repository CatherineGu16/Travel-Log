import type { Pin } from '../lib/derive.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import type { RoutePoint } from '../lib/route.ts'
import { deleteTrip } from '../lib/travelActions.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import { AvatarStack } from './Avatar.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { useToast } from './toastContext.ts'
import { TravelModeBadge } from './TravelMode.tsx'

/**
 * The preview card for a selected pin. A place visited more than once shows its dates stacked;
 * picking a date switches the card (and the route on the map) to that trip. A floating card, not a
 * modal, so the map stays usable.
 */
export function PinCard({
  pin,
  trip,
  route,
  data,
  onSelectTrip,
  onDetails,
  onEdit,
  onClose,
}: {
  pin: Pin
  trip: Trip
  route: RoutePoint[]
  data: TravelData
  onSelectTrip: (tripId: string) => void
  onDetails: (trip: Trip) => void
  onEdit: (trip: Trip) => void
  onClose: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)

  const remove = () => {
    const undoId = store.apply((d, c) => deleteTrip(d, c, trip.id), `Deleted ${trip.title}`)
    if (undoId !== null) toast(`Deleted ${trip.title}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
  }

  return (
    <section
      aria-label={`${pin.place.name} trips`}
      className="pointer-events-auto flex max-h-[min(55dvh,34rem)] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgb(0_0_0/0.25)] sm:w-96"
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pin.trips.length > 1 && (
          <div role="radiogroup" aria-label="Visits" className="flex flex-col gap-1 border-b border-line px-2 py-2">
            {pin.trips.map((t) => {
              const on = t.id === trip.id
              // This place's own dates on that trip, when you gave them.
              const here = t.destinations.find((d) => d.placeId === pin.place.id)
              const dates = here?.startDate ? formatDateRange(here.startDate, here.endDate) : formatDateRange(t.startDate, t.endDate, t.approximate)
              return (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => onSelectTrip(t.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm ${on ? 'bg-raised' : 'hover:bg-raised/60'}`}
                >
                  <span className={`size-2.5 shrink-0 rounded-full ${on ? 'bg-primary' : 'border border-muted'}`} aria-hidden />
                  <span className={`shrink-0 tabular-nums ${on ? 'font-bold' : ''}`}>{dates}</span>
                  <span className="min-w-0 truncate text-muted">{t.title}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex items-baseline gap-2">
            <h3 className="min-w-0 flex-1 truncate font-bold">{trip.title}</h3>
            {trip.isFamily && <span className="shrink-0 rounded-full bg-park/15 px-2 py-0.5 text-xs font-bold text-park">Family</span>}
            <TravelModeBadge mode={trip.travelMode} />
          </div>
          <p className="text-sm text-muted">{formatDateRange(trip.startDate, trip.endDate, trip.approximate)}</p>
          {route.length > 1 && (
            <ol aria-label="Route" className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
              {route.map((r, i) => (
                <li key={r.place.id + i} className="flex items-center gap-1">
                  {i > 0 && (
                    <span aria-hidden className="text-muted">
                      ⋯
                    </span>
                  )}
                  {r.number === null ? (
                    <PinGlyph park={!!r.place.parkId} className="size-4" />
                  ) : (
                    <span className="grid size-5 place-items-center rounded-full bg-[var(--route)] text-[0.7rem] font-bold text-[var(--route-text)]">{r.number}</span>
                  )}
                  <span className={r.role === 'main' ? 'font-bold' : ''}>{r.place.name}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 flex items-center gap-1">
            <AvatarStack people={people} />
            <span className="ml-auto" />
            <button onClick={() => onDetails(trip)} className="min-h-10 rounded-lg px-3 text-sm font-bold hover:bg-raised">
              Details
            </button>
            <button onClick={() => onEdit(trip)} className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
              Edit
            </button>
            <button onClick={remove} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-raised hover:text-danger">
              Delete
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
