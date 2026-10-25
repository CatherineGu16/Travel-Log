import { useMemo, useState } from 'react'
import { hikesDone, parkVisits, type HikeDone } from '../lib/derive.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { formatDateRange, formatPartialDate } from '../lib/partialDate.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { addHike, removeHike } from '../lib/travelActions.ts'
import type { TravelData, Trip, TripHike } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import parksJson from '../data/national-parks.json'
import { HikeFacts } from './HikeFacts.tsx'
import { HikeAdder } from './HikeAdder.tsx'
import { useNpsHikes } from '../ui/useNpsHikes.ts'
import { Sheet } from './Sheet.tsx'
import { useToast } from './toastContext.ts'

const details = new Map(parksJson.map((p) => [p.id, p]))

/**
 * One national park: when you visited (dates stacked), and the hikes you've done there. Adding a
 * hike puts it on one of your trips there; if you've been more than once, it asks which.
 */
export function ParkSheet({
  parkId,
  data,
  onLogVisit,
  onShowTrip,
  onClose,
}: {
  parkId: string
  data: TravelData
  onLogVisit: (park: ParkInfo) => void
  onShowTrip: (trip: Trip) => void
  onClose: () => void
}) {
  const store = useStore()
  const toast = useToast()
  const park = PARKS.find((p) => p.id === parkId)!
  const info = details.get(parkId)
  const npsHikes = useNpsHikes(parkId)
  const [choosing, setChoosing] = useState<TripHike | null>(null)
  const [needVisit, setNeedVisit] = useState(false)

  const visits = useMemo(() => parkVisits(data, parkId), [data, parkId])
  const done = useMemo(() => hikesDone(data, parkId), [data, parkId])
  // Newest first.
  const doneList = [...done.values()].sort((a, b) => (b.times[0]?.date ?? '').localeCompare(a.times[0]?.date ?? ''))
  const npsOf = (h: HikeDone) => npsHikes.find((n) => n.id === h.hikeId) ?? null

  const addTo = (tripId: string, hike: TripHike) => {
    const trip = visits.find((v) => v.trip.id === tripId)?.trip
    const undoId = store.apply((d, c) => addHike(d, c, tripId, hike), `Added ${hike.name}`)
    if (undoId !== null) toast(`${hike.name} added to ${trip?.title ?? 'your trip'}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    setChoosing(null)
  }

  /** Adds a hike: straight onto your only visit, or asks which visit. */
  const check = (hike: TripHike) => {
    setNeedVisit(false)
    if (visits.length === 0) return setNeedVisit(true)
    if (visits.length === 1) return addTo(visits[0].trip.id, hike)
    setChoosing(hike)
  }

  const uncheck = (h: HikeDone) => {
    const trips = h.times.map((t) => t.trip.id)
    const undoId = store.apply((d, c) => trips.reduce((acc, id) => removeHike(acc, c, id, h.key), d), `Removed ${h.name}`)
    if (undoId !== null) toast(`Removed ${h.name}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
  }

  const meta = [
    park.states.map((s) => s.replace(/^US-/, '')).join(', '),
    info?.established && `Est. ${info.established.slice(0, 4)}`,
    info?.areaAcres && `${info.areaAcres.toLocaleString()} acres`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={park.fullName} description={meta} accent="var(--park)">
      <div className="flex flex-col gap-6">
        <section aria-label="Visits">
          {visits.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3">
              <span className="text-muted">Not visited yet.</span>
              <button onClick={() => onLogVisit(park)} className="ml-auto min-h-10 rounded-lg bg-park px-4 font-bold text-white">
                Log a visit
              </button>
            </div>
          ) : (
            <>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <span className="grid size-5 place-items-center rounded-full bg-park text-xs text-white">✓</span>
                Visited {visits.length === 1 ? 'once' : `${visits.length} times`}
                <button onClick={() => onLogVisit(park)} className="ml-auto min-h-9 rounded-lg px-2 text-sm font-bold text-park hover:bg-raised">
                  + Log another visit
                </button>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {visits.map((v) => (
                  <li key={v.trip.id}>
                    <button onClick={() => onShowTrip(v.trip)} className="min-h-8 rounded-full bg-raised px-2.5 text-sm hover:bg-line">
                      <span className="font-bold">{formatDateRange(v.startDate, v.endDate, v.approximate)}</span>
                      <span className="ml-1.5 text-muted">{v.trip.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Hikes">
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="font-display text-xl font-semibold">Hikes you've done</h3>
            {doneList.length > 0 && <span className="text-sm text-muted">{doneList.length}</span>}
          </div>
          {needVisit && (
            <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-raised p-3 text-sm">
              Hikes go on a trip. Log your visit first.
              <button onClick={() => onLogVisit(park)} className="font-bold text-park">
                Log a visit
              </button>
            </p>
          )}
          {doneList.length === 0 ? (
            <p className="mb-3 text-sm text-muted">None yet. Add the hikes you did here; suggestions come from NPS and your past hikes.</p>
          ) : (
            <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
              {doneList.map((h) => {
                const nps = npsOf(h)
                return (
                  <li key={h.key} className="flex min-h-11 items-center gap-2 py-1.5 pr-1 pl-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{h.name}</span>
                      {nps && <HikeFacts hike={nps} />}
                      <span className="block text-xs text-muted">{h.times.map((t) => `${formatPartialDate(t.date)} · ${t.trip.title}`).join('  ·  ')}</span>
                    </span>
                    {nps?.npsUrl && (
                      <a
                        href={nps.npsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs text-muted underline hover:text-fg"
                        aria-label={`${h.name} on nps.gov`}
                      >
                        nps.gov
                      </a>
                    )}
                    <button
                      aria-label={`Remove ${h.name}`}
                      onClick={() => uncheck(h)}
                      className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
                    >
                      <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <HikeAdder
            parkId={parkId}
            data={data}
            has={(hikeId, name) => doneList.some((h) => (hikeId !== null && h.hikeId === hikeId) || h.name.toLowerCase() === name.trim().toLowerCase())}
            onAdd={check}
          />
          {choosing && (
            <TripChooser
              visits={visits}
              onPick={(id) => addTo(id, choosing)}
              onCancel={() => setChoosing(null)}
              label={`Which trip was “${choosing.name}” on?`}
            />
          )}
        </section>
      </div>
    </Sheet>
  )
}

function TripChooser({
  visits,
  onPick,
  onCancel,
  label = 'Which trip?',
}: {
  visits: { trip: Trip; startDate: string; endDate: string | null; approximate: boolean }[]
  onPick: (tripId: string) => void
  onCancel: () => void
  label?: string
}) {
  return (
    <div role="group" aria-label={label} className="my-2 rounded-lg bg-raised p-2">
      <p className="mb-1.5 px-1 text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {visits.map((v) => (
          <button key={v.trip.id} onClick={() => onPick(v.trip.id)} className="min-h-9 rounded-full bg-surface px-3 text-sm hover:bg-line">
            <span className="font-bold">{formatDateRange(v.startDate, v.endDate, v.approximate)}</span>
            <span className="ml-1.5 text-muted">{v.trip.title}</span>
          </button>
        ))}
        <button onClick={onCancel} className="min-h-9 px-2 text-sm text-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}
