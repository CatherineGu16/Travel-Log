import { useMemo, useState } from 'react'
import { hasStarted, hikesDone, parkVisits, type HikeDone } from '../lib/derive.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { formatDateRange, formatPartialDate, todayIso, yearOf } from '../lib/partialDate.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { addHike, removeHike } from '../lib/travelActions.ts'
import type { TravelData, Trip, TripHike } from '../lib/types.ts'
import { useStore, useSyncState } from '../store/useTravel.ts'
import parksJson from '../data/national-parks.json'
import { HikeFacts } from './HikeFacts.tsx'
import { HikeAdder } from './HikeAdder.tsx'
import { HikeCorrections } from './HikeCorrections.tsx'
import { TurnableBadge } from './ParkBadge.tsx'
import { WhoWent } from './WhoWent.tsx'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { sameHikeName } from '../lib/addedHikes.ts'
import { useAddedHikes, useNpsHikes } from '../ui/useNpsHikes.ts'
import { addedHikeFacts } from '../lib/hikeEdits.ts'
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
  const npsHikes = useNpsHikes(parkId, data)
  const addedHikes = useAddedHikes(parkId, data)
  // Only the public repo's owner corrects the shared suggestions.
  const { sharesHikes } = useSyncState()
  const [choosing, setChoosing] = useState<TripHike | null>(null)
  const [needVisit, setNeedVisit] = useState(false)

  const visits = useMemo(() => parkVisits(data, parkId), [data, parkId])
  // Visits that have happened (a trip dated ahead is upcoming); newest first, so the first visit is last.
  const today = todayIso()
  const been = visits.filter((v) => hasStarted(v.startDate, today))
  const firstVisit = been.at(-1)?.startDate ?? null
  // The Hikes section: open or closed as you last left it; until then, open when it's short or
  // you've done hikes here.
  const [hikesShown, setHikesShown] = usePersistentState<'auto' | 'open' | 'closed'>('travel.park.hikes', 'auto', (v) =>
    v === 'open' || v === 'closed' ? v : 'auto',
  )
  const done = useMemo(() => hikesDone(data, parkId), [data, parkId])
  // Newest first.
  const doneList = [...done.values()].sort((a, b) => (b.times[0]?.date ?? '').localeCompare(a.times[0]?.date ?? ''))
  // A hike's facts: NPS's, or (for one you typed in) the shared added hike's, as corrected.
  const npsOf = (h: HikeDone) => npsHikes.find((n) => n.id === h.hikeId) ?? (h.hikeId === null ? addedHikeFacts(addedHikes, h.name) : null)

  // Every hike suggested here (NPS's and the ones people added, as corrected), A–Z.
  const allHikes = [
    ...npsHikes.filter((h) => !h.hidden).map((h) => ({ hike: h, hikeId: h.id as string | null })),
    ...addedHikes.filter((h) => !h.hidden && !npsHikes.some((n) => sameHikeName(n.name, h.name))).map((h) => ({ hike: h, hikeId: null })),
  ].sort((a, b) => a.hike.name.localeCompare(b.hike.name))
  const isDone = (hikeId: string | null, name: string) => doneList.some((h) => (hikeId !== null && h.hikeId === hikeId) || sameHikeName(h.name, name))
  const hikesOpen = hikesShown === 'auto' ? doneList.length > 0 || allHikes.length <= 8 : hikesShown === 'open'

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
    if (undoId !== null) toast(`Removed ${h.name}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }], { long: true })
  }

  const meta = [
    park.states.map((s) => s.replace(/^US-/, '')).join(', '),
    info?.established && `Est. ${info.established.slice(0, 4)}`,
    info?.areaAcres && `${info.areaAcres.toLocaleString()} acres`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Sheet open swipeToClose onOpenChange={(o) => !o && onClose()} title={park.fullName} description={meta} accent="var(--park)">
      <div className="flex flex-col gap-6">
        {/* The badge, which turns over to show when you first visited, and how often you've been. */}
        <section aria-label="Badge" className="flex flex-col items-center gap-2 text-center">
          <TurnableBadge parkId={parkId} name={park.name} earned={been.length > 0} firstVisit={firstVisit} size={176} />
          <p className="text-xs text-muted">Drag or tap the badge to turn it over</p>
          <p className="font-bold">
            {been.length > 0 ? `Visited ${been.length === 1 ? 'once' : `${been.length} times`} · first in ${yearOf(firstVisit!)}` : 'Not visited yet'}
          </p>
          <button
            onClick={() => onLogVisit(park)}
            className={`min-h-11 rounded-lg px-4 font-bold ${been.length ? 'text-park hover:bg-raised' : 'bg-park text-white'}`}
          >
            {been.length ? '+ Log another visit' : 'Log a visit'}
          </button>
        </section>

        {visits.length > 0 && (
          <section aria-label="Visits">
            <h3 className="mb-2 font-display text-xl font-semibold">Visits</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {visits.map((v) => (
                <li key={v.trip.id}>
                  <button onClick={() => onShowTrip(v.trip)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-raised">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {formatDateRange(v.startDate, v.endDate, v.approximate)}
                        {!hasStarted(v.startDate, today) && <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-xs font-bold text-muted">Upcoming</span>}
                      </span>
                      <span className="block truncate text-sm text-muted">{v.trip.title}</span>
                    </span>
                    <WhoWent trip={v.trip} data={data} size={24} max={3} />
                    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" aria-hidden>
                      <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Hikes">
          <button
            type="button"
            aria-expanded={hikesOpen}
            onClick={() => setHikesShown(hikesOpen ? 'closed' : 'open')}
            className="-mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg px-1 text-left hover:bg-raised"
          >
            <span className="font-display text-xl font-semibold">Hikes</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted">
              {[doneList.length > 0 && `${doneList.length} done`, allHikes.length > 0 && `${allHikes.length} in this park`].filter(Boolean).join(' · ')}
            </span>
            <svg viewBox="0 0 20 20" className={`size-5 shrink-0 text-muted transition-transform ${hikesOpen ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {hikesOpen && (
            <div className="mt-2">
              <h4 className="mb-2 text-sm font-bold">Hikes you've done</h4>
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
                <ul aria-label="Hikes you've done" className="mb-3 divide-y divide-line rounded-xl border border-line">
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
              {allHikes.length > 0 && (
                <section aria-label="All hikes in this park" className="mt-5">
                  <h4 className="mb-2 text-sm font-bold">All hikes in this park</h4>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {allHikes.map(({ hike, hikeId }) => {
                      const done = isDone(hikeId, hike.name)
                      return (
                        <li key={hike.id} className="flex min-h-11 items-center gap-2 py-1 pr-1 pl-3">
                          <span className="min-w-0 flex-1">
                            <span className={`text-sm ${done ? 'font-bold' : ''}`}>{hike.name}</span>
                            <HikeFacts hike={hike} />
                          </span>
                          {hike.npsUrl && (
                            <a href={hike.npsUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted underline hover:text-fg" aria-label={`${hike.name} on nps.gov`}>
                              nps.gov
                            </a>
                          )}
                          {done ? (
                            <span aria-label={`${hike.name}: done`} className="grid size-10 shrink-0 place-items-center text-park">
                              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                                <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          ) : (
                            <button
                              aria-label={`Add ${hike.name}`}
                              onClick={() => check({ parkId, hikeId, name: hike.name, date: null })}
                              className="grid size-10 shrink-0 place-items-center rounded-md text-primary hover:bg-raised"
                            >
                              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}
        </section>

        {sharesHikes && npsHikes.length + addedHikes.length > 0 && <HikeCorrections parkId={parkId} hikes={npsHikes} added={addedHikes} />}
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
