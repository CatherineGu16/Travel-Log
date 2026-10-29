import { parksVisited, statesVisited, tripsPerRegion } from './derive.ts'
import { legMemory } from './legs.ts'
import { comparePartialDates, tripDays, yearOf } from './partialDate.ts'
import { distancesByMode, routeOf } from './route.ts'
import type { TravelData } from './types.ts'

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
    driveMiles: Math.round(driveM / 1609.344),
    flightMiles: Math.round(flightM / 1609.344),
    hikes: trips.reduce((n, t) => n + t.hikes.length, 0),
    since: first ? yearOf(first.startDate) : null,
  }
}
