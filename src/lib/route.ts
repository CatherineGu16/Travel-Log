import { distanceMeters } from './geo.ts'
import { legsOf, type Leg, type LegMemory } from './legs.ts'
import type { Home, LngLat, Place, Trip } from './types.ts'

export interface RoutePoint {
  place: Place
  /** Main destinations are drawn as pins; stops get numbered dots; home starts and ends the trip. */
  role: 'main' | 'stop' | 'home'
  /** 1-based visit order among the stops (main destinations and home have none). */
  number: number | null
  /** Bends in the line on the way here from the previous point, [lng, lat]. */
  via: LngLat[]
  /** Shown in place of the number ("A", "B" while you shape one leg of a route). */
  marker?: string
  /** How you got here from the previous point; null for the first. */
  leg: Leg | null
  /** A stop passed again on the way back the same way (already shown, so no second marker). */
  returning?: boolean
}

/** Home as a route point's place (it isn't one of your places, so it never gets a pin). */
const homePlace = (h: Home): Place => ({ ...h, city: null, countryCode: 'US', regionCode: null, parkId: null })

/**
 * A trip's route: its destinations in the order you entered them, back through them when you came
 * back the same way, and from and back to home when you drove from home. Empty when there's
 * nowhere to go between (a single place).
 */
export function routeOf(trip: Trip, places: Place[], opts: { home?: Home | null; memory?: LegMemory } = {}): RoutePoint[] {
  const home = opts.home && !opts.home.deleted ? opts.home : null
  const legs = legsOf(trip, { places, home }, opts.memory)
  if (!legs.length) return []
  const byId = new Map(places.map((p) => [p.id, p]))
  let n = 0
  const stops: Omit<RoutePoint, 'leg'>[] = trip.destinations.flatMap((d) => {
    const place = byId.get(d.placeId)
    return place ? [{ place, role: d.isMain ? ('main' as const) : ('stop' as const), number: d.isMain ? null : ++n, via: d.via }] : []
  })
  const atHome: Omit<RoutePoint, 'leg'>[] = home && trip.fromHome && stops.length ? [{ place: homePlace(home), role: 'home', number: null, via: [] }] : []
  // On the way back, each stop is reached along the reversed leg that left it.
  const back: Omit<RoutePoint, 'leg'>[] =
    trip.returnSameWay && stops.length > 1 ? stops.slice(0, -1).reverse().map((p) => ({ ...p, returning: true })) : []
  return [...atHome, ...stops, ...back, ...atHome].map((p, i) => ({ ...p, via: i === 0 ? [] : legs[i - 1].via, leg: i === 0 ? null : legs[i - 1] }))
}

/** The line through a route: each point, after the bends on the way to it. */
export const routeLine = (route: RoutePoint[]): LngLat[] => route.flatMap((r) => [...r.via, [r.place.lng, r.place.lat] as LngLat])

/**
 * Adds a tapped bend to the leg from `from` to `to`, where it adds the least distance, so the line
 * goes through your taps in a sensible order whichever order you tap them.
 */
export function addBend(from: LngLat, via: LngLat[], to: LngLat, bend: LngLat): LngLat[] {
  const pt = ([lng, lat]: LngLat) => ({ lng, lat })
  const points = [from, ...via, to].map(pt)
  let best = 0
  let bestCost = Infinity
  for (let i = 0; i <= via.length; i++) {
    const cost = distanceMeters(points[i], pt(bend)) + distanceMeters(pt(bend), points[i + 1]) - distanceMeters(points[i], points[i + 1])
    if (cost < bestCost) [best, bestCost] = [i, cost]
  }
  return [...via.slice(0, best), bend, ...via.slice(best)]
}

/**
 * Where a place fits best in a list of stops: the position that adds the least distance. Used to
 * convert trips saved before destinations had an order of their own (a main place plus stops).
 */
export function insertCheapest<T extends { lat: number; lng: number }>(stops: T[], place: T): T[] {
  let best = 0
  let bestCost = Infinity
  for (let i = 0; i <= stops.length; i++) {
    const before = stops[i - 1]
    const after = stops[i]
    const cost =
      (before ? distanceMeters(before, place) : 0) + (after ? distanceMeters(place, after) : 0) - (before && after ? distanceMeters(before, after) : 0)
    if (cost < bestCost) [best, bestCost] = [i, cost]
  }
  return [...stops.slice(0, best), place, ...stops.slice(best)]
}
