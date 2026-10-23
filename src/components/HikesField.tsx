import { useEffect, useState } from 'react'
import { loadParkHikes, PARKS, type NpsHike } from '../lib/gazetteer.ts'
import { hikeKey } from '../lib/travelActions.ts'
import type { TripHike } from '../lib/types.ts'

/**
 * "Hikes" in the trip form, shown when the trip includes a national park: check off that park's
 * hikes from nps.gov, add your own, and optionally date each one.
 */
export function HikesField({ parkIds, value, onChange }: { parkIds: string[]; value: TripHike[]; onChange: (hikes: TripHike[]) => void }) {
  const [all, setAll] = useState<Record<string, NpsHike[]>>({})
  useEffect(() => {
    void loadParkHikes().then(setAll)
  }, [])
  if (parkIds.length === 0) return null

  const keyOf = (h: TripHike) => hikeKey(h.parkId, h.hikeId, h.name)
  const has = (parkId: string, hikeId: string | null, name: string) => value.some((h) => keyOf(h) === hikeKey(parkId, hikeId, name))
  const toggle = (hike: TripHike) =>
    onChange(has(hike.parkId, hike.hikeId, hike.name) ? value.filter((h) => keyOf(h) !== keyOf(hike)) : [...value, hike])
  const setDate = (hike: TripHike, date: string | null) => onChange(value.map((h) => (keyOf(h) === keyOf(hike) ? { ...h, date } : h)))

  return (
    <section aria-label="Hikes" className="flex flex-col gap-4">
      {parkIds.map((parkId) => {
        const park = PARKS.find((p) => p.id === parkId)
        const listed = all[parkId] ?? []
        const custom = value.filter((h) => h.parkId === parkId && !listed.some((l) => l.id === h.hikeId))
        const count = value.filter((h) => h.parkId === parkId).length
        return (
          <details key={parkId} className="rounded-lg border border-line" open={count > 0 || parkIds.length === 1}>
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-bold">
              Hikes in {park?.name ?? parkId}
              <span className="font-normal text-muted">{count > 0 ? `${count} checked` : listed.length ? `${listed.length} listed` : ''}</span>
            </summary>
            <div className="border-t border-line p-2">
              {listed.length === 0 && <p className="px-1 pb-2 text-sm text-muted">NPS doesn't list hikes for this park yet. Add yours below.</p>}
              <ul className="max-h-72 overflow-y-auto">
                {[...listed.map((l) => ({ hikeId: l.id as string | null, name: l.name })), ...custom.map((c) => ({ hikeId: c.hikeId, name: c.name }))].map((l) => {
                  const hike = value.find((h) => keyOf(h) === hikeKey(parkId, l.hikeId, l.name))
                  return (
                    <li key={hikeKey(parkId, l.hikeId, l.name)} className="flex min-h-10 items-center gap-2 px-1">
                      <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!hike}
                          onChange={() => toggle({ parkId, hikeId: l.hikeId, name: l.name, date: null })}
                          className="size-4 shrink-0 accent-[var(--park)]"
                        />
                        <span className={`truncate text-sm ${hike ? 'font-bold' : ''}`}>{l.name}</span>
                      </label>
                      {hike && (
                        <input
                          type="date"
                          aria-label={`${l.name} date`}
                          value={hike.date ?? ''}
                          onChange={(e) => setDate(hike, e.target.value || null)}
                          className="h-9 shrink-0 rounded-md border border-line bg-bg px-2 text-sm"
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
              <AddCustomHike onAdd={(name) => !has(parkId, null, name) && onChange([...value, { parkId, hikeId: null, name, date: null }])} />
            </div>
          </details>
        )
      })}
    </section>
  )
}

function AddCustomHike({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const add = () => {
    if (name.trim()) onAdd(name.trim())
    setName('')
  }
  return (
    <div className="mt-2 flex gap-2 px-1">
      <input
        aria-label="Add a hike that isn't listed"
        placeholder="Add a hike that isn't listed"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-base"
      />
      <button type="button" onClick={add} className="h-10 rounded-lg border border-line px-3 text-sm font-bold hover:bg-raised">
        Add
      </button>
    </div>
  )
}
