import { isState, parksVisited, statesVisited, tripPlaceIds, tripsPerRegion } from './derive.ts'
import { formatDistance, legMemory } from './legs.ts'
import { comparePartialDates, tripDays, yearOf } from './partialDate.ts'
import { distancesByMode, routeOf } from './route.ts'
import { countryName, regionName } from './states.ts'
import type { LegMode, TravelData, Trip, TripHike } from './types.ts'

const METERS_PER_MILE = 1609.344
const newestFirst = (a: Trip, b: Trip) => comparePartialDates(b.startDate, a.startDate)

/** Your travel in numbers, for the You page. Distances are rough: they follow the drawn lines. */
export function travelTotals(data: TravelData) {
  const trips = data.trips.filter((t) => !t.deleted)
  const memory = legMemory(data)
  let driveM = 0
  let flightM = 0
  for (const t of trips) {
    const d = distancesByMode(routeOf(t, data.places, { home: data.home, memory }))
    driveM += d.drive ?? 0
    flightM += d.flight ?? 0
  }
  const placeIds = new Set(trips.flatMap((t) => t.destinations.map((d) => d.placeId)))
  const first = [...trips].sort((a, b) => comparePartialDates(a.startDate, b.startDate))[0]
  return {
    states: statesVisited(tripsPerRegion(data)),
    parks: parksVisited(data).size,
    countries: new Set(data.places.filter((p) => placeIds.has(p.id)).map((p) => p.countryCode)).size,
    trips: trips.length,
    days: trips.reduce((n, t) => n + (tripDays(t.startDate, t.endDate) ?? 0), 0),
    driveMiles: Math.round(driveM / METERS_PER_MILE),
    flightMiles: Math.round(flightM / METERS_PER_MILE),
    hikes: trips.reduce((n, t) => n + t.hikes.length, 0),
    since: first ? yearOf(first.startDate) : null,
  }
}

/** The states (or countries) you've been to, each with its trips (newest first), most trips first. */
export function tripsByArea(data: TravelData, area: 'state' | 'country'): { code: string; name: string; trips: Trip[] }[] {
  const placeOf = new Map(data.places.map((p) => [p.id, p]))
  const areas = new Map<string, Trip[]>()
  for (const trip of data.trips.filter((t) => !t.deleted)) {
    const codes = new Set(
      tripPlaceIds(trip)
        .map((id) => placeOf.get(id))
        .map((p) => (area === 'country' ? p?.countryCode : p?.regionCode && isState(p.regionCode) ? p.regionCode : null))
        .filter((c): c is string => !!c),
    )
    for (const c of codes) areas.set(c, [...(areas.get(c) ?? []), trip])
  }
  return [...areas]
    .map(([code, trips]) => ({ code, name: area === 'country' ? countryName(code) : regionName(code), trips: trips.sort(newestFirst) }))
    .sort((a, b) => b.trips.length - a.trips.length || a.name.localeCompare(b.name))
}

/** Trips by how much of something they had (days, or miles driven or flown), most first; trips with none are left out. */
export function tripsBy(data: TravelData, measure: 'days' | 'drive' | 'flight'): { trip: Trip; amount: number }[] {
  const memory = legMemory(data)
  return data.trips
    .filter((t) => !t.deleted)
    .map((trip) => {
      if (measure === 'days') return { trip, amount: tripDays(trip.startDate, trip.endDate) ?? 0 }
      const meters = distancesByMode(routeOf(trip, data.places, { home: data.home, memory }))[measure] ?? 0
      return { trip, amount: Math.round(meters / METERS_PER_MILE) }
    })
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount || newestFirst(a.trip, b.trip))
}

/** Every hike you've logged, with its trip, newest first. */
export function hikesLogged(data: TravelData): { hike: TripHike; trip: Trip }[] {
  return data.trips
    .filter((t) => !t.deleted)
    .flatMap((trip) => trip.hikes.map((hike) => ({ hike, trip })))
    .sort((a, b) => comparePartialDates(b.hike.date ?? b.trip.startDate, a.hike.date ?? a.trip.startDate))
}

/** "820 mi driven": how each way of traveling reads in a trip's summary. */
const MODE_WORDS: Record<LegMode, string> = { drive: 'driven', flight: 'flown', train: 'by train', cruise: 'cruising', boat: 'by boat', walk: 'walked', unknown: '' }

/** How far a trip went each way, biggest first: ["~820 mi driven", "~1,200 mi flown"]. */
function tripDistances(trip: Trip, data: TravelData): string[] {
  const route = routeOf(trip, data.places, { home: data.home, memory: legMemory(data) })
  return Object.entries(distancesByMode(route))
    .filter(([mode, m]) => mode !== 'unknown' && m >= 1609)
    .sort((a, b) => b[1] - a[1])
    .map(([mode, m]) => `~${formatDistance(m)} ${MODE_WORDS[mode as LegMode]}`)
}

/** Where a trip went and how far, for under its title (its dates are in its details): "Zion & Bryce Canyon · ~820 mi driven". */
export function tripWhere(trip: Trip, data: TravelData): string {
  const mains = trip.destinations
    .filter((d) => d.isMain)
    .map((d) => data.places.find((p) => p.id === d.placeId)?.name)
    .filter((n): n is string => !!n)
  return [mains.join(' & '), ...tripDistances(trip, data)].filter(Boolean).join(' · ')
}
