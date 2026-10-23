import { byNewest, tripPlaceIds } from './derive.ts'
import { formatDateRange, yearOf } from './partialDate.ts'
import { regionName } from './states.ts'
import { live } from './travelActions.ts'
import { tripTypeLabel } from './tripTypes.ts'
import type { TravelData, TravelMode, Trip, TripType } from './types.ts'

/** Filters shared by the map and the lists, remembered per device. */
export interface TripFilter {
  /** Family, friends or work trips; null for all. */
  type: TripType | null
  /** Trips with any of these people on them. */
  personIds: string[]
  year: string | null
  tag: string | null
  /** Road trip, flight or cruise. */
  mode: TravelMode | null
}

export const NO_FILTER: TripFilter = { type: null, personIds: [], year: null, tag: null, mode: null }

export const activeFilterCount = (f: TripFilter) =>
  Number(f.type !== null) + Number(f.personIds.length > 0) + Number(f.year !== null) + Number(f.tag !== null) + Number(f.mode !== null)

/** Accepts whatever was stored (older versions, hand edits) and falls back to no filter. */
export function reviveFilter(stored: unknown): TripFilter {
  const s = (stored ?? {}) as Partial<TripFilter> & { who?: string }
  const type = s.type === 'family' || s.type === 'friends' || s.type === 'work' ? s.type : s.who === 'family' ? 'family' : null
  return {
    type,
    personIds: Array.isArray(s.personIds) ? s.personIds.filter((x): x is string => typeof x === 'string') : [],
    year: typeof s.year === 'string' ? s.year : null,
    tag: typeof s.tag === 'string' ? s.tag : null,
    mode: s.mode === 'road-trip' || s.mode === 'flight' || s.mode === 'cruise' ? s.mode : null,
  }
}

export function matchesFilter(trip: Trip, f: TripFilter): boolean {
  if (f.type && trip.tripType !== f.type) return false
  if (f.personIds.length && !f.personIds.some((id) => trip.companions.includes(id))) return false
  if (f.year && yearOf(trip.startDate) !== f.year && !(trip.endDate && yearOf(trip.startDate) < f.year && yearOf(trip.endDate) >= f.year))
    return false
  if (f.tag && !trip.tags.includes(f.tag)) return false
  if (f.mode && trip.travelMode !== f.mode) return false
  return true
}

/** Your data with only the trips that pass the filter, so pins and shading can be derived as usual. */
export function filterData(data: TravelData, f: TripFilter): TravelData {
  if (activeFilterCount(f) === 0) return data
  return { ...data, trips: data.trips.filter((t) => t.deleted || matchesFilter(t, f)) }
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Free-text search across a trip's title, places, notes, people, groups and tags. */
export function matchesSearch(trip: Trip, data: TravelData, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const places = tripPlaceIds(trip).map((id) => data.places.find((p) => p.id === id))
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)?.name)
  const groups = live(data.groups)
    .filter((g) => g.memberIds.some((m) => trip.companions.includes(m)))
    .map((g) => g.name)
  const haystack = normalize(
    [
      trip.title,
      ...places.flatMap((p) => [p?.name, p?.city, regionName(p?.regionCode ?? null)]),
      trip.description,
      trip.highlights,
      ...people,
      ...groups,
      ...trip.tags,
      tripTypeLabel(trip.tripType) ?? '',
      trip.travelMode === 'road-trip' ? 'road trip' : (trip.travelMode ?? ''),
      formatDateRange(trip.startDate, trip.endDate),
    ]
      .filter(Boolean)
      .join(' \n '),
  )
  return words.every((w) => haystack.includes(w))
}

export type TripGrouping = 'year' | 'state' | 'type'
export type TripSort = 'newest' | 'oldest' | 'title' | 'rating'

export interface TripGroup {
  key: string
  label: string
  trips: Trip[]
}

const SORTS: Record<TripSort, (a: Trip, b: Trip) => number> = {
  newest: byNewest,
  oldest: (a, b) => -byNewest(a, b),
  title: (a, b) => a.title.localeCompare(b.title),
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byNewest(a, b),
}

/** Trips grouped (year, state of the first main destination, or trip type) and sorted within each group. */
export function groupTrips(trips: Trip[], data: TravelData, grouping: TripGrouping, sort: TripSort): TripGroup[] {
  const keyOf = (t: Trip): [string, string] => {
    if (grouping === 'year') return [yearOf(t.startDate), yearOf(t.startDate)]
    if (grouping === 'type') {
      const i = ['family', 'friends', 'work'].indexOf(t.tripType ?? '')
      return i < 0 ? ['9', 'Other'] : [String(i), tripTypeLabel(t.tripType)!]
    }
    const firstMain = t.destinations.find((d) => d.isMain)?.placeId
    const region = data.places.find((p) => p.id === firstMain)?.regionCode ?? null
    const name = regionName(region)
    return [name, name]
  }
  const groups = new Map<string, TripGroup>()
  for (const t of trips) {
    const [key, label] = keyOf(t)
    if (!groups.has(key)) groups.set(key, { key, label, trips: [] })
    groups.get(key)!.trips.push(t)
  }
  const order = [...groups.values()].sort((a, b) =>
    grouping === 'year' ? (sort === 'oldest' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)) : a.key.localeCompare(b.key),
  )
  for (const g of order) g.trips.sort(SORTS[sort])
  return order
}

/** Years and tags that appear on your trips, for the filter choices. */
export function filterOptions(data: TravelData) {
  const trips = live(data.trips)
  const years = [...new Set(trips.map((t) => yearOf(t.startDate)))].sort().reverse()
  const tags = [...new Set(trips.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b))
  return { years, tags }
}
