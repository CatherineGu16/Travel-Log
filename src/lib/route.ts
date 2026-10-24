import { distanceMeters } from './geo.ts'
import type { LngLat, Place, Trip } from './types.ts'

export interface RoutePoint {
  place: Place
  /** Main destinations are drawn as pins; stops get numbered dots. */
  role: 'main' | 'stop'
  /** 1-based visit order among the stops (main destinations have none). */
  number: number | null
  /** Bends in the line on the way here from the previous point, [lng, lat]. */
  via: LngLat[]
  /** Shown in place of the number ("A", "B" while you shape one leg of a route). */
  marker?: string
}

/** A trip's route: its destinations in the order you entered them. Empty for a single place. */
export function routeOf(trip: Trip, places: Place[]): RoutePoint[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const points = trip.destinations.flatMap((d) => {
    const place = byId.get(d.placeId)
    return place ? [{ place, isMain: d.isMain, via: d.via }] : []
  })
  if (points.length < 2) return []
  let n = 0
  return points.map(({ place, isMain, via }, i) => ({ place, role: isMain ? 'main' : 'stop', number: isMain ? null : ++n, via: i === 0 ? [] : via }))
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
