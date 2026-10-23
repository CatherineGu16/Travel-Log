import { useEffect, useMemo, useState } from 'react'
import { hikesDone, parkVisits } from '../lib/derive.ts'
import { loadParkHikes, PARKS, type NpsHike } from '../lib/gazetteer.ts'
import { formatDateRange } from '../lib/partialDate.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { regionName } from '../lib/states.ts'
import type { TravelData } from '../lib/types.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { Empty, ListPage, Select } from './TripsPage.tsx'

export type ParkShow = 'all' | 'visited' | 'not-visited'
type ParkOrder = 'az' | 'state'

const SHOWS: { id: ParkShow; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'visited', label: 'Visited' },
  { id: 'not-visited', label: 'Not visited' },
]

/** All 64 national parks as a checklist, with your visits stacked and hikes done. */
export function ParksPage({ data, onOpenPark, onLogVisit }: { data: TravelData; onOpenPark: (parkId: string) => void; onLogVisit: (park: ParkInfo) => void }) {
  const [show, setShow] = usePersistentState<ParkShow>('travel.parks.show', 'all', (v) => (SHOWS.some((s) => s.id === v) ? (v as ParkShow) : 'all'))
  const [order, setOrder] = usePersistentState<ParkOrder>('travel.parks.order', 'az', (v) => (v === 'state' ? 'state' : 'az'))
  const [hikes, setHikes] = useState<Record<string, NpsHike[]>>({})
  useEffect(() => {
    void loadParkHikes().then(setHikes)
  }, [])

  const rows = useMemo(
    () =>
      PARKS.map((park) => {
        const visits = parkVisits(data, park.id)
        const done = hikesDone(data, park.id)
        const listed = hikes[park.id] ?? []
        const doneHikes = [...done.values()]
        return {
          park,
          visits,
          hikesDone: listed.filter((h) => doneHikes.some((d) => d.hikeId === h.id)).length,
          hikesListed: listed.length,
          // Hikes you added yourself, on top of the NPS list.
          extraHikes: doneHikes.filter((d) => !listed.some((h) => h.id === d.hikeId)).length,
        }
      }),
    [data, hikes],
  )
  const visitedCount = rows.filter((r) => r.visits.length > 0).length
  const shown = rows.filter((r) => show === 'all' || (show === 'visited') === r.visits.length > 0)

  const groups =
    order === 'az'
      ? [{ label: null as string | null, rows: shown }]
      : [...new Set(shown.flatMap((r) => r.park.states))]
          .map((code) => ({ label: regionName(code), rows: shown.filter((r) => r.park.states.includes(code)) }))
          .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <ListPage title="National parks" count={`${visitedCount} / ${PARKS.length} visited`}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Parks visited" aria-valuenow={visitedCount} aria-valuemax={PARKS.length}>
        <div className="h-full rounded-full bg-park" style={{ width: `${(visitedCount / PARKS.length) * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Show" className="flex rounded-lg border border-line bg-surface p-0.5">
          {SHOWS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={show === s.id}
              onClick={() => setShow(s.id)}
              className={`min-h-10 rounded-md px-3 text-sm ${show === s.id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Select label="Order" value={order} options={[{ id: 'az', label: 'A–Z' }, { id: 'state', label: 'State' }]} onChange={setOrder} />
      </div>

      {shown.length === 0 ? (
        <Empty>{show === 'visited' ? 'No parks visited yet.' : 'You’ve been to every park!'}</Empty>
      ) : (
        groups.map((g) => (
          <section key={g.label ?? 'all'} aria-label={g.label ?? 'Parks'} className="mt-6">
            {g.label && <h2 className="mb-2 font-display text-xl font-semibold">{g.label}</h2>}
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {g.rows.map(({ park, visits, hikesDone: hd, hikesListed, extraHikes }) => {
                const visited = visits.length > 0
                return (
                  <li key={park.id} className="flex items-center gap-3 px-3 py-2.5" aria-label={park.name}>
                    <span
                      aria-label={visited ? 'Visited' : 'Not visited'}
                      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${visited ? 'border-park bg-park text-white' : 'border-line text-transparent'}`}
                    >
                      ✓
                    </span>
                    <button onClick={() => onOpenPark(park.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate font-bold">{park.name}</span>
                        <span className="shrink-0 text-xs text-muted">{park.states.map((s) => s.replace(/^US-/, '')).join(', ')}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {visited ? visits.map((v) => formatDateRange(v.startDate, v.endDate, v.approximate)).join(' · ') : 'Not visited yet'}
                        {hikesListed > 0 && ` · Hikes ${hd} / ${hikesListed}`}
                        {extraHikes > 0 && (hikesListed > 0 ? ` +${extraHikes}` : ` · Hikes ${extraHikes}`)}
                      </span>
                    </button>
                    {!visited && (
                      <button onClick={() => onLogVisit(park)} className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-bold text-park hover:bg-raised">
                        Log a visit
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </ListPage>
  )
}
