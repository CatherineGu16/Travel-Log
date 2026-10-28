import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Pin } from '../lib/derive.ts'
import { legMemory, legModeInfo } from '../lib/legs.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import { routeOf, type RoutePoint } from '../lib/route.ts'
import { regionName } from '../lib/states.ts'
import { deleteTrip } from '../lib/travelActions.ts'
import type { TravelData, Trip } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import { HomeGlyph } from './LegRow.tsx'
import { PinGlyph } from './PlacePicker.tsx'
import { useToast } from './toastContext.ts'
import { WhoWent } from './WhoWent.tsx'

/**
 * The preview card for a selected pin. A place visited more than once has a card per trip: swipe
 * between them on a phone, or pick from the list on a wider screen. The trip shown is the one whose
 * route the map draws. A floating card, not a modal, so the map stays usable.
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
  const summary = (t: Trip) => (
    <TripSummary trip={t} route={routes.get(t.id) ?? []} data={data} onDetails={onDetails} onEdit={onEdit} onDelete={remove} />
  )
  const many = pin.trips.length > 1
  const phone = usePhone()
  const where = pin.place.countryCode === 'US' ? pin.place.regionCode?.replace(/^US-/, '') : regionName(null, pin.place.countryCode)

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

      {phone ? (
        // Phones: a card per trip, side by side; swipe or tap a dot.
        <div className="min-h-0 flex-1 overflow-y-auto">
          {many ? <Swiper trips={pin.trips} current={trip} onSelect={onSelectTrip} label={datesHere} card={summary} /> : summary(trip)}
        </div>
      ) : (
        // Wider screens: the trips as a list, the chosen one below.
        <div className="min-h-0 flex-1 overflow-y-auto">
          {many && (
            <div role="radiogroup" aria-label="Visits" className="flex flex-col gap-1 border-b border-line px-2 py-2">
              {pin.trips.map((t) => {
                const on = t.id === trip.id
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={on}
                    onClick={() => onSelectTrip(t.id)}
                    className={`flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm ${on ? 'bg-raised' : 'hover:bg-raised/60'}`}
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${on ? 'bg-primary' : 'border border-muted'}`} aria-hidden />
                    <span className={`shrink-0 tabular-nums ${on ? 'font-bold' : ''}`}>{datesHere(t)}</span>
                    <span className="min-w-0 truncate text-muted">{t.title}</span>
                  </button>
                )
              })}
            </div>
          )}
          {summary(trip)}
        </div>
      )}
    </section>
  )
}

const PHONE = '(max-width: 639px)'
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(PHONE)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
/** Whether the screen is phone-sized (Tailwind's below-`sm`), following rotation and resizing. */
const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches)

/**
 * Trips side by side, one per screen width, snapping into place. Settling on a card picks its trip
 * (so the map redraws); picking a dot scrolls to it. Cards out of view are hidden from screen readers.
 */
function Swiper({
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
  const strip = useRef<HTMLDivElement>(null)
  const index = Math.max(0, trips.findIndex((t) => t.id === current.id))

  // Show the chosen trip (picked from a dot, or opened from elsewhere).
  useEffect(() => {
    const el = strip.current
    if (el && Math.round(el.scrollLeft / el.clientWidth) !== index) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }, [index])

  // When a swipe settles, the card in view is the trip shown.
  useEffect(() => {
    const el = strip.current
    if (!el) return
    let timer = 0
    const settle = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const t = trips[Math.round(el.scrollLeft / el.clientWidth)]
        if (t && t.id !== current.id) onSelect(t.id)
      }, 120)
    }
    el.addEventListener('scroll', settle, { passive: true })
    return () => {
      el.removeEventListener('scroll', settle)
      window.clearTimeout(timer)
    }
  }, [trips, current.id, onSelect])

  return (
    <div>
      <div ref={strip} aria-roledescription="carousel" className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trips.map((t, i) => (
          <div key={t.id} aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${trips.length}`} className="w-full shrink-0 snap-center">
            {card(t)}
          </div>
        ))}
      </div>
      <div role="radiogroup" aria-label="Visits" className="flex items-center justify-center gap-1 pb-2">
        {trips.map((t, i) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={i === index}
            onClick={() => onSelect(t.id)}
            className="grid size-7 place-items-center rounded-full"
          >
            <span aria-hidden className={`block rounded-full transition-all ${i === index ? 'h-2 w-5 bg-primary' : 'size-2 bg-line'}`} />
            <span className="sr-only">
              {label(t)} {t.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** One trip on the pin card: title, dates, route, who went, and what you can do. */
function TripSummary({
  trip,
  route,
  data,
  onDetails,
  onEdit,
  onDelete,
}: {
  trip: Trip
  route: RoutePoint[]
  data: TravelData
  onDetails: (trip: Trip) => void
  onEdit: (trip: Trip) => void
  onDelete: (trip: Trip) => void
}) {
  return (
    <div className="px-4 py-3">
      <h3 className="truncate font-bold">{trip.title}</h3>
      <p className="text-sm text-muted">{formatDateRange(trip.startDate, trip.endDate, trip.approximate)}</p>
      {route.length > 1 && (
        <ol aria-label="Route" className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          {route.map((r, i) =>
            r.returning ? (
              // The way back through the same stops: one entry, not each stop again.
              !route[i - 1].returning && (
                <li key="return" className="text-xs text-muted">
                  ↩ same way back
                </li>
              )
            ) : (
              <li key={r.place.id + i} className="flex items-center gap-1">
                {r.leg && (
                  <span className="text-xs" title={legModeInfo(r.leg.mode).label}>
                    <span aria-hidden>{legModeInfo(r.leg.mode).icon}</span>
                    <span className="sr-only">{legModeInfo(r.leg.mode).label} to</span>
                  </span>
                )}
                {r.role === 'home' ? (
                  <HomeGlyph className="size-4" />
                ) : r.number === null ? (
                  <PinGlyph park={!!r.place.parkId} className="size-4" />
                ) : (
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--route)] text-[0.7rem] font-bold text-[var(--route-text)]">{r.number}</span>
                )}
                <span className={r.role === 'main' ? 'font-bold' : ''}>{r.place.name}</span>
              </li>
            ),
          )}
        </ol>
      )}
      <div className="mt-3 flex items-center gap-1">
        <WhoWent trip={trip} data={data} />
        <span className="ml-auto" />
        <button onClick={() => onDetails(trip)} className="min-h-10 rounded-lg px-3 text-sm font-bold hover:bg-raised">
          Details
        </button>
        <button onClick={() => onEdit(trip)} className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
          Edit
        </button>
        <button onClick={() => onDelete(trip)} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-raised hover:text-danger">
          Delete
        </button>
      </div>
    </div>
  )
}
