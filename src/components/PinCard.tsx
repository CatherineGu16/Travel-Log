import { useEffect, useMemo, useRef } from 'react'
import type { Pin } from '../lib/derive.ts'
import { legMemory } from '../lib/legs.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { routeOf, type RoutePoint } from '../lib/route.ts'
import { regionName } from '../lib/states.ts'
import { deleteTrip } from '../lib/travelActions.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import { PinGlyph } from './PlacePicker.tsx'
import { useToast } from './toastContext.ts'
import { WhoWent } from './WhoWent.tsx'

/**
 * A place's trips (a map pin), filling the Trips panel or sheet (Trips › Moab): one card per visit,
 * stacked. The highlighted one is the trip whose route the map draws; Details opens it.
 */
export function PinCard({
  pin,
  trip,
  data,
  onSelectTrip,
  onDetails,
  onEdit,
  onClose,
}: {
  pin: Pin
  trip: Trip
  data: TravelData
  onSelectTrip: (tripId: string) => void
  onDetails: (trip: Trip) => void
  onEdit: (trip: Trip) => void
  onClose: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const routes = useMemo(() => {
    const memory = legMemory(data)
    return new Map(pin.trips.map((t) => [t.id, routeOf(t, data.places, { home: data.home, memory })]))
  }, [pin.trips, data])

  const remove = (t: Trip) => {
    const undoId = store.apply((d, c) => deleteTrip(d, c, t.id), `Deleted ${t.title}`)
    if (undoId !== null) toast(`Deleted ${t.title}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
  }
  // This place's own dates on a trip, when you gave them.
  const datesHere = (t: Trip) => {
    const here = t.destinations.find((d) => d.placeId === pin.place.id)
    return here?.startDate ? formatDateRange(here.startDate, here.endDate) : formatDateRange(t.startDate, t.endDate, t.approximate)
  }
  const summary = (t: Trip, dated = false) => (
    <TripSummary
      trip={t}
      route={routes.get(t.id) ?? []}
      data={data}
      // In the stack, the card's top line already shows the dates; repeat the trip's only if they differ.
      hideDates={dated && datesHere(t) === formatDateRange(t.startDate, t.endDate, t.approximate)}
      onDetails={onDetails}
      onEdit={onEdit}
      onDelete={remove}
    />
  )
  const many = pin.trips.length > 1
  const where = pin.place.countryCode === 'US' ? pin.place.regionCode?.replace(/^US-/, '') : regionName(null, pin.place.countryCode)

  return (
    <section
      aria-label={`${pin.place.name} trips`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <PinGlyph park={pin.isPark} className="mt-1 size-5" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-semibold">{pin.place.name}</h2>
          <p className="text-sm text-muted">
            {many ? `${pin.trips.length} visits` : '1 visit'}
            {where && ` · ${where}`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {many ? (
        // Every trip as its own card, in a column that scrolls; click a card to show its route.
        <Stack trips={pin.trips} current={trip} onSelect={onSelectTrip} label={datesHere} card={(t) => summary(t, true)} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">{summary(trip)}</div>
      )}
    </section>
  )
}

/**
 * The trips at a place, one card each, in a column that scrolls. Each card's date line picks it
 * (or click anywhere on the card); the picked one is highlighted and kept in view.
 */
function Stack({
  trips,
  current,
  onSelect,
  label,
  card,
}: {
  trips: Trip[]
  current: Trip
  onSelect: (tripId: string) => void
  label: (t: Trip) => string
  card: (t: Trip) => React.ReactNode
}) {
  const column = useRef<HTMLDivElement>(null)
  useEffect(() => {
    column.current?.querySelector('[aria-checked="true"]')?.closest('[data-card]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current.id])
  return (
    <div ref={column} role="radiogroup" aria-label="Visits" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-bg p-2">
      {trips.map((t) => {
        const on = t.id === current.id
        return (
          <div
            key={t.id}
            data-card
            onClick={() => !on && onSelect(t.id)}
            className={`shrink-0 overflow-hidden rounded-xl border bg-surface transition-shadow ${on ? 'border-primary shadow-[0_0_0_2px_var(--primary)]' : 'cursor-pointer border-line hover:border-muted'}`}
          >
            <button
              role="radio"
              aria-checked={on}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(t.id)
              }}
              className="flex w-full items-center gap-2 border-b border-line px-4 pt-2.5 pb-2 text-left text-xs"
            >
              <span className={`tabular-nums ${on ? 'font-bold text-primary' : 'font-bold text-muted'}`}>{label(t)}</span>
              <span className="sr-only">{t.title}</span>
              {on && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">On the map</span>}
            </button>
            {card(t)}
          </div>
        )
      })}
    </div>
  )
}

/** One trip on the pin card: title, dates, the places in order, who went, and what you can do. */
function TripSummary({
  trip,
  route,
  data,
  hideDates = false,
  onDetails,
  onEdit,
  onDelete,
}: {
  trip: Trip
  route: RoutePoint[]
  data: TravelData
  hideDates?: boolean
  onDetails: (trip: Trip) => void
  onEdit: (trip: Trip) => void
  onDelete: (trip: Trip) => void
}) {
  // Just the places you went, in order: how you traveled and the way from home are on the map.
  const places = route.filter((r) => r.role !== 'home')
  return (
    <div className="px-4 py-3">
      <h3 className="truncate font-bold">{trip.title}</h3>
      {!hideDates && <p className="text-sm text-muted">{formatDateRange(trip.startDate, trip.endDate, trip.approximate)}</p>}
      {places.length > 1 && (
        <ol aria-label={`Route of ${trip.title}`} className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          {places.map((r, i) => (
            <li key={r.place.id + i} className="flex items-center gap-1.5">
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
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex items-center gap-1">
        <WhoWent trip={trip} data={data} />
        <span className="ml-auto" />
        <button onClick={() => onDetails(trip)} aria-label={`Details of ${trip.title}`} className="min-h-10 rounded-lg px-3 text-sm font-bold hover:bg-raised">
          Details
        </button>
        <button onClick={() => onEdit(trip)} aria-label={`Edit ${trip.title}`} className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
          Edit
        </button>
        <button onClick={() => onDelete(trip)} aria-label={`Delete ${trip.title}`} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-raised hover:text-danger">
          Delete
        </button>
      </div>
    </div>
  )
}
