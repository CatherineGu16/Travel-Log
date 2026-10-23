import { comparePartialDates } from './partialDate.ts'
import { hikeKey, live } from './travelActions.ts'
import { FAMILY_GROUP_ID, type Group, type Person, type Place, type TravelData, type Trip } from './types.ts'

/** Values computed from your data, never stored. */

/** Newest trip first. */
export const byNewest = (a: Trip, b: Trip) => comparePartialDates(b.startDate, a.startDate) || b.createdAt.localeCompare(a.createdAt)

/** One pin per major location: every place that is a main destination of at least one trip. */
export interface Pin {
  place: Place
  /** Visits to this place, newest first. More than one means stacked dates. */
  trips: Trip[]
  isPark: boolean
}

/** A trip's main destinations (each gets a pin), in visit order. */
export const mainPlaceIds = (trip: Trip) => trip.destinations.filter((d) => d.isMain).map((d) => d.placeId)

export function pinsOf(data: TravelData): Pin[] {
  const places = new Map(live(data.places).map((p) => [p.id, p]))
  const byPlace = new Map<string, Trip[]>()
  for (const trip of live(data.trips))
    for (const placeId of new Set(mainPlaceIds(trip))) {
      if (!places.has(placeId)) continue
      byPlace.set(placeId, [...(byPlace.get(placeId) ?? []), trip])
    }
  return [...byPlace].map(([placeId, trips]) => {
    const place = places.get(placeId)!
    // Newest visit to this place first, by this place's own dates where the trip has them.
    const at = (t: Trip) => t.destinations.find((d) => d.placeId === placeId)?.startDate ?? t.startDate
    return { place, trips: trips.sort((a, b) => comparePartialDates(at(b), at(a)) || byNewest(a, b)), isPark: place.parkId !== null }
  })
}

/** Every place a trip visited, in order. */
export const tripPlaceIds = (trip: Trip) => trip.destinations.map((d) => d.placeId)

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

/** True when the Family group is tagged, or anyone on the list is in it. Picks the Family trip type. */
export function includesFamily(data: TravelData, personIds: string[], groupIds: string[] = []): boolean {
  const family = familyGroup(data)
  if (!family) return false
  return groupIds.includes(family.id) || personIds.some((id) => family.memberIds.includes(id))
}

/** Everyone on a trip: the people listed, plus the members of any group tagged on it. */
export function tripPeopleIds(trip: Trip, data: TravelData): string[] {
  const members = live(data.groups)
    .filter((g) => trip.companionGroupIds.includes(g.id))
    .flatMap((g) => g.memberIds)
  return [...new Set([...trip.companions, ...members])]
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

export interface Visit {
  trip: Trip
  /** This destination's own dates when it has them, otherwise the trip's. */
  startDate: string
  endDate: string | null
  approximate: boolean
}

/** Every visit to a place: its stacked dates, newest first, using that destination's own dates when set. */
export function visitsTo(data: TravelData, placeId: string): Visit[] {
  const visits: Visit[] = []
  for (const trip of live(data.trips)) {
    const stop = trip.destinations.find((d) => d.placeId === placeId)
    if (!stop) continue
    const own = stop.startDate ? { startDate: stop.startDate, endDate: stop.endDate } : null
    visits.push({ trip, startDate: own?.startDate ?? trip.startDate, endDate: own ? own.endDate : trip.endDate, approximate: trip.approximate })
  }
  return visits.sort((a, b) => comparePartialDates(b.startDate, a.startDate) || byNewest(a.trip, b.trip))
}

export interface ParkVisit extends Visit {
  placeId: string
}

/** Every visit to a national park (through any place linked to it), newest first. */
export function parkVisits(data: TravelData, parkId: string): ParkVisit[] {
  const visits = live(data.places)
    .filter((p) => p.parkId === parkId)
    .flatMap((p) => visitsTo(data, p.id).map((v) => ({ ...v, placeId: p.id })))
  // One entry per trip, even if it visited two places linked to the park.
  const byTrip = new Map(visits.map((v) => [v.trip.id, v]))
  return [...byTrip.values()].sort((a, b) => comparePartialDates(b.startDate, a.startDate) || byNewest(a.trip, b.trip))
}

export interface HikeDone {
  key: string
  hikeId: string | null
  name: string
  /** Each time you did it: the trip and the hike's own date if you gave one. Newest first. */
  times: { trip: Trip; date: string }[]
}

/** The hikes you've done in a park, across all trips, with their dates stacked. */
export function hikesDone(data: TravelData, parkId: string): Map<string, HikeDone> {
  const done = new Map<string, HikeDone>()
  for (const trip of live(data.trips))
    for (const h of trip.hikes) {
      if (h.parkId !== parkId) continue
      const key = hikeKey(h.parkId, h.hikeId, h.name)
      const entry = done.get(key) ?? { key, hikeId: h.hikeId, name: h.name, times: [] }
      entry.times.push({ trip, date: h.date ?? trip.startDate })
      done.set(key, entry)
    }
  for (const entry of done.values()) entry.times.sort((a, b) => comparePartialDates(b.date, a.date))
  return done
}
