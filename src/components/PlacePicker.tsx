import { useEffect, useId, useMemo, useState } from 'react'
import { visitsPerPlace } from '../lib/derive.ts'
import { loadTowns, loadWorldCities, parkAt, PARKS } from '../lib/gazetteer.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { searchOnline } from '../lib/onlineSearch.ts'
import { useMapDetail } from '../ui/mapDetail.ts'
import { searchPlaces, type SearchResult, type TownRow, type WorldCities } from '../lib/placeSearch.ts'
import { describeRef, type ChosenPlace } from '../lib/chosenPlace.ts'
import { live } from '../lib/travelActions.ts'
import type { TravelData } from '../lib/types.ts'

const NO_RESULTS: SearchResult[] = []

/**
 * Pick a place: type to search your places, national parks, US towns and cities worldwide (all offline). A chosen
 * place shows as a chip; a dropped pin can be renamed.
 */
export function PlacePicker({
  label,
  data,
  value,
  onChange,
  autoFocus = false,
  near = null,
  hideLabel = false,
  placeholder = 'Search a city, town or park',
}: {
  label: string
  /** Keep the label for screen readers only (something else on screen says what it's for). */
  hideLabel?: boolean
  placeholder?: string
  data: TravelData
  value: ChosenPlace | null
  onChange: (place: ChosenPlace | null) => void
  autoFocus?: boolean
  /** Prefer towns near here (the trip's main destination) when names repeat. */
  near?: { lat: number; lng: number } | null
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [towns, setTowns] = useState<TownRow[]>([])
  const [world, setWorld] = useState<WorldCities | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    void loadTowns().then(setTowns)
    void loadWorldCities().then(setWorld)
  }, [])

  const yours = useMemo(() => live(data.places), [data.places])
  const visits = useMemo(() => visitsPerPlace(data), [data])
  const local = useMemo(() => searchPlaces(query, { yours, visits, parks: PARKS, towns, world }, 8, near), [query, yours, visits, towns, world, near])

  // With the detailed map on, landmarks and addresses from Photon follow the offline results.
  const detailed = useMapDetail() === 'detailed'
  // Results are kept with the query they answer, so stale ones never show for newer typing.
  const [onlineFor, setOnlineFor] = useState<{ query: string; results: SearchResult[] }>({ query: '', results: [] })
  const q = query.trim()
  const online = detailed && onlineFor.query === q ? onlineFor.results : NO_RESULTS
  useEffect(() => {
    if (!detailed || q.length < 3) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchOnline(q, controller.signal)
        .then((results) => setOnlineFor({ query: q, results }))
        .catch(() => {})
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, detailed])
  const results = useMemo(() => {
    const seen = new Set(local.map((r) => `${r.label.toLowerCase()}|${r.detail}`))
    return [...local.slice(0, 6), ...online.filter((r) => !seen.has(`${r.label.toLowerCase()}|${r.detail}`)).slice(0, 5)]
  }, [local, online])

  const choose = (r: SearchResult) => {
    onChange({ ...describeRef(r.ref, data), label: r.label })
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
        <ParkSuggestion
          value={value}
          onLink={(park) => 'place' in value.ref && onChange(describeRef({ place: { ...value.ref.place, parkId: park.id, name: park.fullName } }, data))}
        />
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-bold'}>
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
          placeholder={placeholder}
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
                <span className={`shrink-0 text-xs ${r.kind === 'yours' ? 'font-bold text-primary' : 'text-muted'}`}>
                  {r.detail}
                  {r.kind === 'online' && (
                    <span title="From OpenStreetMap (online search)">
                      {r.detail ? ' · ' : ''}OSM
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "This is inside Yosemite National Park — link it?" for a new place that falls inside a park. */
export function ParkSuggestion({ value, onLink }: { value: ChosenPlace; onLink: (park: ParkInfo) => void }) {
  const [found, setFound] = useState<{ at: string; park: ParkInfo | null }>({ at: '', park: null })
  const [dismissed, setDismissed] = useState(false)
  const place = 'place' in value.ref ? value.ref.place : null
  const lat = place?.lat
  const lng = place?.lng
  const linked = !!place?.parkId
  const at = `${lat},${lng}`
  // The park found for this exact spot; a lookup for an earlier spot is ignored.
  const park = found.at === at ? found.park : null
  useEffect(() => {
    if (lat === undefined || lng === undefined || linked) return
    let cancelled = false
    void parkAt(lng, lat).then((p) => !cancelled && setFound({ at: `${lat},${lng}`, park: p }))
    return () => {
      cancelled = true
    }
  }, [lat, lng, linked])
  if (!park || dismissed || linked) return null
  return (
    <div role="status" className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-park/10 px-3 py-2 text-sm">
      <span className="mr-auto">
        This is inside <b>{park.fullName}</b>. Count it as a visit?
      </span>
      <button type="button" onClick={() => onLink(park)} className="min-h-9 rounded-lg bg-park px-3 font-bold text-white">
        Link to park
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="min-h-9 px-2 text-muted">
        No
      </button>
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
