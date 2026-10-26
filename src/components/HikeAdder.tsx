import { useEffect, useId, useMemo, useState } from 'react'
import { loadAddedHikes, sameHikeName, type AddedHikes } from '../lib/addedHikes.ts'
import { hikesDone } from '../lib/derive.ts'
import { matchesHike, type NpsHike } from '../lib/gazetteer.ts'
import { useNpsHikes } from '../ui/useNpsHikes.ts'
import type { TravelData, TripHike } from '../lib/types.ts'
import { HikeFacts } from './HikeFacts.tsx'

interface Suggestion {
  hikeId: string | null
  name: string
  nps: NpsHike | null
  /** Where it comes from: a hike you've done, one someone added, or the park's NPS list. */
  from: 'yours' | 'added' | 'nps'
}

/**
 * "Add a hike" for one park: type and pick from suggestions (hikes you've done there first, then
 * ones people added, then the park's NPS list, with its distance and time), or add exactly what
 * you typed. NPS suggestions are a starting point, not a checklist.
 */
export function HikeAdder({
  parkId,
  data,
  has,
  onAdd,
  label = 'Add a hike',
}: {
  parkId: string
  data: TravelData
  /** Already on the list you're adding to: left out of the suggestions. */
  has: (hikeId: string | null, name: string) => boolean
  onAdd: (hike: TripHike) => void
  label?: string
}) {
  const id = useId()
  const nps = useNpsHikes(parkId, data)
  const [added, setAdded] = useState<AddedHikes>({})
  useEffect(() => {
    void loadAddedHikes().then(setAdded)
  }, [])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const suggestions = useMemo(() => {
    const out: Suggestion[] = []
    const push = (s: Suggestion) => {
      if (has(s.hikeId, s.name) || out.some((o) => sameHikeName(o.name, s.name) || (s.hikeId && o.hikeId === s.hikeId))) return
      out.push(s)
    }
    const npsOf = (hikeId: string | null, name: string) => nps.find((h) => h.id === hikeId) ?? nps.find((h) => sameHikeName(h.name, name)) ?? null
    for (const h of hikesDone(data, parkId).values()) push({ hikeId: h.hikeId, name: h.name, nps: npsOf(h.hikeId, h.name), from: 'yours' })
    for (const h of added[parkId] ?? []) push({ hikeId: null, name: h.name, nps: null, from: 'added' })
    for (const h of nps) if (!h.hidden) push({ hikeId: h.id, name: h.name, nps: h, from: 'nps' })
    return out
  }, [data, parkId, added, nps, has])

  const q = query.trim()
  const shown = (q ? suggestions.filter((s) => matchesHike(s.name, q)) : suggestions).slice(0, 8)
  // What you typed, as a hike of its own, unless it's exactly a suggestion.
  const typed = q && !suggestions.some((s) => sameHikeName(s.name, q)) && !has(null, q) ? q : null
  const options = [...shown.map((s) => ({ kind: 'suggestion' as const, s })), ...(typed ? [{ kind: 'typed' as const, name: typed }] : [])]
  const expanded = open && options.length > 0

  const add = (o: (typeof options)[number]) => {
    onAdd(o.kind === 'typed' ? { parkId, hikeId: null, name: o.name, date: null } : { parkId, hikeId: o.s.hikeId, name: o.s.name, date: null })
    setQuery('')
    setActive(0)
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={label}
        value={query}
        onFocus={() => setOpen(true)}
        // After a tap on an option has landed.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options.length - 1))
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && options[active]) add(options[active])
          else if (e.key === 'Escape') setOpen(false)
          else return
          e.preventDefault()
        }}
        className="h-11 w-full min-w-0 rounded-lg border border-line bg-bg px-3 text-base"
      />
      {expanded && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface shadow-md"
        >
          {options.map((o, i) => (
            <li key={o.kind === 'typed' ? '+typed' : `${o.s.from}:${o.s.hikeId ?? o.s.name}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o)}
                className={`flex min-h-11 w-full flex-col justify-center px-3 py-1.5 text-left ${i === active ? 'bg-raised' : 'hover:bg-raised'}`}
              >
                {o.kind === 'typed' ? (
                  <span>
                    Add “<span className="font-bold">{o.name}</span>”
                  </span>
                ) : (
                  <>
                    <span className="flex items-baseline gap-2">
                      <span className="truncate">{o.s.name}</span>
                      {o.s.from === 'yours' && <span className="shrink-0 text-xs text-muted">done before</span>}
                    </span>
                    {o.s.nps && <HikeFacts hike={o.s.nps} />}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
