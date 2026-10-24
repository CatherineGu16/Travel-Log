import { useEffect, useMemo, useState } from 'react'
import { hikesDone, parkVisits, type HikeDone } from '../lib/derive.ts'
import { loadParkHikes, matchesHike, PARKS, type NpsHike } from '../lib/gazetteer.ts'
import { formatDateRange, formatPartialDate } from '../lib/partialDate.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { addHike, hikeKey, removeHike } from '../lib/travelActions.ts'
import type { TravelData, Trip, TripHike } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import parksJson from '../data/national-parks.json'
import { HikeFacts } from './HikeFacts.tsx'
import { HikeFilter } from './HikeFilter.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './toastContext.ts'

const details = new Map(parksJson.map((p) => [p.id, p]))

/**
 * One national park: when you visited (dates stacked), and its hikes as a checklist. Checking off a
 * hike adds it to one of your trips there; if you've been more than once, it asks which.
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
  const [npsHikes, setNpsHikes] = useState<NpsHike[]>([])
  const [choosing, setChoosing] = useState<TripHike | null>(null)
  const [custom, setCustom] = useState('')
  const [needVisit, setNeedVisit] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void loadParkHikes().then((all) => setNpsHikes(all[parkId] ?? []))
  }, [parkId])

  const visits = useMemo(() => parkVisits(data, parkId), [data, parkId])
  const done = useMemo(() => hikesDone(data, parkId), [data, parkId])
  const customDone = [...done.values()].filter((h) => h.hikeId === null || !npsHikes.some((n) => n.id === h.hikeId))
  const doneCount = npsHikes.filter((h) => done.has(hikeKey(parkId, h.id, h.name))).length
  // NPS hikes first, then hikes you typed in yourself.
  const rows = [
    ...npsHikes.map((h) => ({ name: h.name, hikeId: h.id as string | null, url: h.npsUrl as string | null, nps: h as NpsHike | null })),
    ...customDone.map((h) => ({ name: h.name, hikeId: h.hikeId, url: null, nps: null })),
  ].map((h) => ({ ...h, key: hikeKey(parkId, h.hikeId, h.name) }))
  const choosingKey = choosing && hikeKey(parkId, choosing.hikeId, choosing.name)

  const addTo = (tripId: string, hike: TripHike) => {
    const trip = visits.find((v) => v.trip.id === tripId)?.trip
    const undoId = store.apply((d, c) => addHike(d, c, tripId, hike), `Checked off ${hike.name}`)
    if (undoId !== null) toast(`${hike.name} added to ${trip?.title ?? 'your trip'}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    setChoosing(null)
  }

  /** Check off a hike: straight onto your only visit, or ask which visit. */
  const check = (hike: TripHike) => {
    setNeedVisit(false)
    if (visits.length === 0) return setNeedVisit(true)
    if (visits.length === 1) return addTo(visits[0].trip.id, hike)
    setChoosing(hike)
  }

  const uncheck = (h: HikeDone) => {
    const trips = h.times.map((t) => t.trip.id)
    const undoId = store.apply((d, c) => trips.reduce((acc, id) => removeHike(acc, c, id, h.key), d), `Unchecked ${h.name}`)
    if (undoId !== null) toast(`Unchecked ${h.name}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
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
            <h3 className="font-display text-xl font-semibold">Hikes</h3>
            {npsHikes.length > 0 && (
              <span className="text-sm text-muted">
                {doneCount} / {npsHikes.length}
              </span>
            )}
          </div>
          {npsHikes.length > 0 && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-park" style={{ width: `${(doneCount / npsHikes.length) * 100}%` }} />
            </div>
          )}
          {needVisit && (
            <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-raised p-3 text-sm">
              Hikes go on a trip. Log your visit first.
              <button onClick={() => onLogVisit(park)} className="font-bold text-park">
                Log a visit
              </button>
            </p>
          )}
          {npsHikes.length === 0 && <p className="mb-3 text-sm text-muted">NPS doesn't list hikes for this park yet. Add the ones you did below.</p>}

          {rows.length > 10 && <HikeFilter value={query} onChange={setQuery} />}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {rows.filter((h) => matchesHike(h.name, query)).map((h) => {
                const key = h.key
                const entry = done.get(key)
                const hike: TripHike = { parkId, hikeId: h.hikeId, name: h.name, date: null }
                return (
                  <li key={key} className="px-3 py-1.5">
                    <div className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={h.name}
                        checked={!!entry}
                        onChange={() => (entry ? uncheck(entry) : check(hike))}
                        className="size-5 shrink-0 accent-[var(--park)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={entry ? 'font-bold' : ''}>{h.name}</span>
                        {h.nps && <HikeFacts hike={h.nps} />}
                        {entry && (
                          <span className="block text-xs text-muted">
                            {entry.times.map((t) => `${formatPartialDate(t.date)} · ${t.trip.title}`).join('  ·  ')}
                          </span>
                        )}
                      </span>
                      {h.url && (
                        <a href={h.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted underline hover:text-fg" aria-label={`${h.name} on nps.gov`}>
                          nps.gov
                        </a>
                      )}
                    </div>
                    {choosing && choosingKey === key && <TripChooser visits={visits} onPick={(id) => addTo(id, choosing)} onCancel={() => setChoosing(null)} />}
                  </li>
                )
              })}
          </ul>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (custom.trim()) {
                check({ parkId, hikeId: null, name: custom.trim(), date: null })
                setCustom('')
              }
            }}
          >
            <input
              aria-label="Add a hike that isn't listed"
              placeholder="Add a hike that isn't listed"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-base"
            />
            <button type="submit" className="h-11 rounded-lg border border-line px-4 font-bold hover:bg-raised">
              Add
            </button>
          </form>
          {/* A new hike you typed in isn't a row yet, so its trip choice shows here. */}
          {choosing && !rows.some((r) => r.key === choosingKey) && (
            <TripChooser visits={visits} onPick={(id) => addTo(id, choosing)} onCancel={() => setChoosing(null)} label={`Which trip was “${choosing.name}” on?`} />
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
