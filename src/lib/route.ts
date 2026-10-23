import { distanceMeters } from './geo.ts'
import type { Place, Trip } from './types.ts'

export interface RoutePoint {
  place: Place
  /** Main destinations are drawn as pins; stops get numbered dots. */
  role: 'main' | 'stop'
  /** 1-based visit order among the stops (main destinations have none). */
  number: number | null
}

/** A trip's route: its destinations in the order you entered them. Empty for a single place. */
export function routeOf(trip: Trip, places: Place[]): RoutePoint[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const points = trip.destinations.flatMap((d) => {
    const place = byId.get(d.placeId)
    return place ? [{ place, isMain: d.isMain }] : []
  })
  if (points.length < 2) return []
  let n = 0
  return points.map(({ place, isMain }) => ({ place, role: isMain ? 'main' : 'stop', number: isMain ? null : ++n }))
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
