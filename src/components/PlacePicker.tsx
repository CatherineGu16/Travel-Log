import { useEffect, useId, useMemo, useState } from 'react'
import { visitsPerPlace } from '../lib/derive.ts'
import { loadTowns, PARKS } from '../lib/gazetteer.ts'
import { searchPlaces, type SearchResult, type TownRow } from '../lib/placeSearch.ts'
import { live, type PlaceRef } from '../lib/travelActions.ts'
import type { TravelData } from '../lib/types.ts'

/** What the form shows for a chosen place, before it's saved. */
export interface ChosenPlace {
  ref: PlaceRef
  label: string
  detail: string
  isPark: boolean
}

/** Turns a saved place or a place input into what the form shows. */
export function describeRef(ref: PlaceRef, data: TravelData): ChosenPlace {
  if ('placeId' in ref) {
    const p = data.places.find((x) => x.id === ref.placeId)
    return { ref, label: p?.name ?? 'Unknown place', detail: p?.regionCode?.replace(/^US-/, '') ?? '', isPark: !!p?.parkId }
  }
  return { ref, label: ref.place.name, detail: ref.place.regionCode?.replace(/^US-/, '') ?? '', isPark: !!ref.place.parkId }
}

/**
 * Pick a place: type to search (your places, national parks, US towns, all offline), or tap
 * "Pick on map". A chosen place shows as a chip; a dropped pin can be renamed.
 */
export function PlacePicker({
  label,
  data,
  value,
  onChange,
  onPickOnMap,
  autoFocus = false,
}: {
  label: string
  data: TravelData
  value: ChosenPlace | null
  onChange: (place: ChosenPlace | null) => void
  onPickOnMap: () => void
  autoFocus?: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [towns, setTowns] = useState<TownRow[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    void loadTowns().then(setTowns)
  }, [])

  const yours = useMemo(() => live(data.places), [data.places])
  const visits = useMemo(() => visitsPerPlace(data), [data])
  const results = useMemo(() => searchPlaces(query, { yours, visits, parks: PARKS, towns }), [query, yours, visits, towns])

  const choose = (r: SearchResult) => {
    onChange({ ref: r.ref, label: r.label, detail: r.detail, isPark: r.isPark })
    setQuery('')
  }

  if (value) {
    const renamable = 'place' in value.ref && !value.ref.place.parkId
    return (
      <div>
        <span className="mb-1.5 block text-sm font-bold">{label}</span>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
          <PinGlyph park={value.isPark} />
          <div className="min-w-0 flex-1">
            {renamable ? (
              <input
                aria-label={`${label} name`}
                value={value.label}
                onChange={(e) =>
                  'place' in value.ref &&
                  onChange({ ...value, label: e.target.value, ref: { place: { ...value.ref.place, name: e.target.value } } })
                }
                className="w-full bg-transparent font-bold outline-none"
              />
            ) : (
              <div className="truncate font-bold">{value.label}</div>
            )}
            {value.detail && <div className="text-xs text-muted">{value.detail}</div>}
          </div>
          <button type="button" onClick={() => onChange(null)} className="min-h-10 rounded-md px-2 text-sm text-muted hover:text-fg">
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={`${id}-results`}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Search a city, town or park"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
            else if (e.key === 'Enter' && results[active]) {
              e.preventDefault()
              choose(results[active])
            } else return
            e.preventDefault()
          }}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-base"
        />
        <button type="button" onClick={onPickOnMap} className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-bold hover:bg-raised">
          Pick on map
        </button>
      </div>
      {results.length > 0 && (
        <ul id={`${id}-results`} role="listbox" aria-label={`${label} results`} className="mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-md">
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => choose(r)}
                onPointerEnter={() => setActive(i)}
                className={`flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left ${i === active ? 'bg-raised' : ''}`}
              >
                <PinGlyph park={r.isPark} />
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                <span className={`shrink-0 text-xs ${r.kind === 'yours' ? 'font-bold text-primary' : 'text-muted'}`}>{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PinGlyph({ park, className = 'size-5' }: { park: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className} ${park ? 'text-park' : 'text-primary'}`}>
      <path d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7z" fill="currentColor" />
      <circle cx="12" cy="9" r="2.6" fill="var(--surface)" />
    </svg>
  )
}
