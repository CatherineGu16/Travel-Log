import { useState } from 'react'
import { matchesHike } from '../lib/gazetteer.ts'
import type { ShownHike } from '../lib/hikeEdits.ts'
import { resetHikeEdit, saveHikeEdit } from '../lib/travelActions.ts'
import type { DistanceKind, HikeDifficulty } from '../lib/types.ts'
import { useStore } from '../store/useTravel.ts'
import { HikeFacts } from './HikeFacts.tsx'
import { useToast } from './toastContext.ts'

/**
 * For the public repo's owner: fix the NPS hike suggestions for a park (name, distance, time,
 * difficulty) or hide ones that shouldn't be suggested. Saved like any edit (with Undo) and shared
 * to the public list on the next sync, so every device gets them after the next deploy.
 */
export function HikeCorrections({ parkId, hikes }: { parkId: string; hikes: ShownHike[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const edited = hikes.filter((h) => h.original).length
  const shown = hikes.filter((h) => matchesHike(h.name, query)).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section aria-label="Correct hike info" className="mt-4 rounded-xl border border-dashed border-line">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm">
        <span className="flex-1">
          <span className="font-bold">Correct the NPS hike info</span>
          <span className="block text-xs text-muted">
            {hikes.length} suggested{edited > 0 && ` · ${edited} corrected`}. Fixes are shared to the public list when you sync.
          </span>
        </span>
        <svg viewBox="0 0 20 20" className={`size-4 shrink-0 text-muted ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-line p-2">
          {hikes.length > 10 && (
            <input
              type="search"
              aria-label="Find a suggested hike"
              placeholder="Find a suggested hike"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-2 h-10 w-full min-w-0 rounded-lg border border-line bg-bg px-3 text-base"
            />
          )}
          <ul className="divide-y divide-line">
            {shown.map((h) =>
              editing === h.id ? (
                <li key={h.id} className="py-2">
                  <EditForm parkId={parkId} hike={h} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={h.id} className="flex min-h-11 items-center gap-2 px-1 py-1">
                  <span className={`min-w-0 flex-1 ${h.hidden ? 'text-muted line-through' : ''}`}>
                    <span className="text-sm">{h.name}</span>
                    {h.hidden ? <span className="ml-2 text-xs no-underline">hidden</span> : <HikeFacts hike={h} />}
                  </span>
                  {h.original && <span className="shrink-0 text-xs text-muted">corrected</span>}
                  <button
                    type="button"
                    aria-label={`Edit ${h.name}`}
                    onClick={() => setEditing(h.id)}
                    className="min-h-9 shrink-0 rounded-md px-2 text-sm font-bold text-primary hover:bg-raised"
                  >
                    Edit
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  )
}

function EditForm({ parkId, hike, onDone }: { parkId: string; hike: ShownHike; onDone: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [name, setName] = useState(hike.name)
  const [distance, setDistance] = useState(hike.distanceMi === null ? '' : String(hike.distanceMi))
  const [kind, setKind] = useState<DistanceKind | ''>(hike.distanceKind ?? '')
  const [duration, setDuration] = useState(hike.duration ?? '')
  const [difficulty, setDifficulty] = useState<HikeDifficulty | ''>(hike.difficulty ?? '')
  const [hidden, setHidden] = useState(hike.hidden)
  const [error, setError] = useState<string | null>(null)
  const input = 'h-10 w-full min-w-0 rounded-lg border border-line bg-bg px-3 text-base'

  const save = () => {
    const miles = distance.trim() === '' ? null : Number(distance)
    if (miles !== null && !(miles >= 0)) return setError('Distance is a number of miles, like 4.5.')
    if (!name.trim()) return setError('A hike needs a name.')
    const undoId = store.apply(
      (d, c) => saveHikeEdit(d, c, { parkId, hikeId: hike.id, name, distanceMi: miles, distanceKind: miles === null ? null : kind || null, duration, difficulty: difficulty || null, hidden }),
      `Corrected ${name}`,
    )
    if (undoId !== null) toast(`Corrected ${name.trim()}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onDone()
  }
  const reset = () => {
    const undoId = store.apply((d, c) => resetHikeEdit(d, c, parkId, hike.id), `Reset ${hike.name}`)
    if (undoId !== null) toast(`${hike.original?.name ?? hike.name} is back to NPS's info`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onDone()
  }

  return (
    <div role="group" aria-label={`Edit ${hike.name}`} className="flex flex-col gap-3 rounded-lg bg-raised p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-bold">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0 text-sm">
          <span className="mb-1 block font-bold">Distance (mi)</span>
          <input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Unknown" className={input} />
        </label>
        <label className="block min-w-0 text-sm">
          <span className="mb-1 block font-bold">Distance is</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as DistanceKind | '')} className={input}>
            <option value="">Not stated</option>
            <option>round trip</option>
            <option>one way</option>
            <option>loop</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-bold">Time</span>
        <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="2–3 hours" className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-bold">Difficulty</span>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as HikeDifficulty | '')} className={input}>
          <option value="">Not set</option>
          <option>Easy</option>
          <option>Moderate</option>
          <option>Strenuous</option>
        </select>
      </label>
      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="size-4" />
        Don't suggest this hike
      </label>
      {hike.original && (
        <p className="text-xs text-muted">
          NPS says: {hike.original.name}
          {hike.original.distanceMi !== null && ` · ${hike.original.distanceMi} mi${hike.original.distanceKind ? ` ${hike.original.distanceKind}` : ''}`}
          {hike.original.duration && ` · ${hike.original.duration}`}
          {hike.original.difficulty && ` · ${hike.original.difficulty}`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary">
          Save
        </button>
        <button type="button" onClick={onDone} className="min-h-10 rounded-lg px-3 text-sm font-bold text-muted hover:text-fg">
          Cancel
        </button>
        {hike.original && (
          <button type="button" onClick={reset} className="ml-auto min-h-10 rounded-lg px-3 text-sm font-bold text-muted hover:text-fg">
            Use NPS's info
          </button>
        )}
      </div>
    </div>
  )
}
