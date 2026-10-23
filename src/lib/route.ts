import { distanceMeters } from './geo.ts'
import type { Place, Trip } from './types.ts'

export interface RoutePoint {
  place: Place
  /** The main destination is drawn as the pin itself; stops get numbered dots. */
  role: 'main' | 'stop'
  /** 1-based visit order among the stops (the main destination has none). */
  number: number | null
}

/**
 * A trip's route in visit order: its stops as entered, with the main destination slotted in where
 * it adds the least distance (a trip's main destination has no position of its own in the list).
 * Returns an empty route when the trip has no stops.
 */
export function routeOf(trip: Trip, places: Place[]): RoutePoint[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const main = byId.get(trip.mainPlaceId)
  const stops = trip.stops.map((s) => byId.get(s.placeId)).filter((p): p is Place => !!p)
  if (!main || stops.length === 0) return []

  // If the main destination is also listed as a stop, the stops already say where it goes.
  const order = stops.some((s) => s.id === main.id) ? stops : insertCheapest(stops, main)
  let n = 0
  return order.map((place) => {
    const isMain = place.id === main.id
    return { place, role: isMain ? 'main' : 'stop', number: isMain ? null : ++n }
  })
}

function insertCheapest(stops: Place[], main: Place): Place[] {
  let best = 0
  let bestCost = Infinity
  for (let i = 0; i <= stops.length; i++) {
    const before = stops[i - 1]
    const after = stops[i]
    const cost =
      (before ? distanceMeters(before, main) : 0) +
      (after ? distanceMeters(main, after) : 0) -
      (before && after ? distanceMeters(before, after) : 0)
    if (cost < bestCost) [best, bestCost] = [i, cost]
  }
  return [...stops.slice(0, best), main, ...stops.slice(best)]
}
