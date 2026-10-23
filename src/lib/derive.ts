import { comparePartialDates } from './partialDate.ts'
import { live } from './travelActions.ts'
import { FAMILY_GROUP_ID, type Group, type Person, type Place, type TravelData, type Trip } from './types.ts'

/** Values computed from your data, never stored. */

/** Newest trip first. */
export const byNewest = (a: Trip, b: Trip) => comparePartialDates(b.startDate, a.startDate) || b.createdAt.localeCompare(a.createdAt)

/** One pin per major location: every place that is the main destination of at least one trip. */
export interface Pin {
  place: Place
  /** Visits to this place, newest first. More than one means stacked dates. */
  trips: Trip[]
  isPark: boolean
}

export function pinsOf(data: TravelData): Pin[] {
  const places = new Map(live(data.places).map((p) => [p.id, p]))
  const byPlace = new Map<string, Trip[]>()
  for (const trip of live(data.trips)) {
    if (!places.has(trip.mainPlaceId)) continue
    byPlace.set(trip.mainPlaceId, [...(byPlace.get(trip.mainPlaceId) ?? []), trip])
  }
  return [...byPlace].map(([placeId, trips]) => {
    const place = places.get(placeId)!
    return { place, trips: trips.sort(byNewest), isPark: place.parkId !== null }
  })
}

/** Every place a trip visited: its main destination and its stops. */
export const tripPlaceIds = (trip: Trip) => [trip.mainPlaceId, ...trip.stops.map((s) => s.placeId)]

/** How many trips visited each state (a trip counts once per state, however many stops it had there). */
export function tripsPerRegion(data: TravelData): Map<string, number> {
  const regionOf = new Map(data.places.map((p) => [p.id, p.regionCode]))
  const counts = new Map<string, number>()
  for (const trip of live(data.trips)) {
    const regions = new Set(tripPlaceIds(trip).map((id) => regionOf.get(id)).filter((r): r is string => !!r))
    for (const r of regions) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  return counts
}

const NOT_STATES = new Set(['US-DC', 'US-PR', 'US-VI', 'US-GU', 'US-AS', 'US-MP'])

/** Of the 50 states, how many you've been to. */
export const statesVisited = (perRegion: Map<string, number>) =>
  [...perRegion.keys()].filter((r) => r.startsWith('US-') && !NOT_STATES.has(r)).length

export function parksVisited(data: TravelData): Set<string> {
  const parkOf = new Map(data.places.map((p) => [p.id, p.parkId]))
  const parks = new Set<string>()
  for (const trip of live(data.trips))
    for (const id of tripPlaceIds(trip)) {
      const park = parkOf.get(id)
      if (park) parks.add(park)
    }
  return parks
}

/** State shading steps: 1 · 2–3 · 4–6 · 7+ trips. 0 means not visited. */
export function shadeLevel(trips: number): 0 | 1 | 2 | 3 | 4 {
  if (trips <= 0) return 0
  if (trips === 1) return 1
  if (trips <= 3) return 2
  if (trips <= 6) return 3
  return 4
}

export const familyGroup = (data: TravelData): Group | undefined => data.groups.find((g) => g.id === FAMILY_GROUP_ID && !g.deleted)

/** True when anyone on the list is in the Family group. Drives the Family switch's default. */
export function includesFamily(data: TravelData, personIds: string[]): boolean {
  const family = new Set(familyGroup(data)?.memberIds ?? [])
  return personIds.some((id) => family.has(id))
}

export const livePeople = (data: TravelData): Person[] => live(data.people).sort((a, b) => a.name.localeCompare(b.name))

/** Groups with Family first, then A–Z. */
export const liveGroups = (data: TravelData): Group[] =>
  live(data.groups).sort((a, b) => Number(b.isFamily) - Number(a.isFamily) || a.name.localeCompare(b.name))

/** How many trips each place appears on (as main destination or stop). */
export function visitsPerPlace(data: TravelData): Map<string, number> {
  const counts = new Map<string, number>()
  for (const trip of live(data.trips)) for (const id of new Set(tripPlaceIds(trip))) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}
