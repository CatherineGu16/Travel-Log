import { distanceMeters } from './geo.ts'
import { legsOf, tripStart, type Leg, type LegMemory } from './legs.ts'
import type { Home, LngLat, Place, Trip, TripStart } from './types.ts'

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

/** Where the trip started as a route point's place (not one of your places, so it never gets a pin). */
const homePlace = (s: TripStart): Place => ({ id: 'home', name: s.name, lat: s.lat, lng: s.lng, city: null, countryCode: 'US', regionCode: null, parkId: null, createdAt: '', updatedAt: '' })

/**
 * A trip's route: its destinations in the order you entered them, back through them when you came
 * back the same way, and from and back to where it started (usually home). Empty when there's
 * nowhere to go between (a single place).
 */
export function routeOf(trip: Trip, places: Place[], opts: { home?: Home | null; memory?: LegMemory } = {}): RoutePoint[] {
  const legs = legsOf(trip, { places, home: opts.home ?? null }, opts.memory)
  const start = tripStart(trip, { home: opts.home ?? null })
  if (!legs.length) return []
  const byId = new Map(places.map((p) => [p.id, p]))
  let n = 0
  const stops: Omit<RoutePoint, 'leg'>[] = trip.destinations.flatMap((d) => {
    const place = byId.get(d.placeId)
    return place ? [{ place, role: d.isMain ? ('main' as const) : ('stop' as const), number: d.isMain ? null : ++n, via: d.via }] : []
  })
  const atHome: Omit<RoutePoint, 'leg'>[] = start && stops.length ? [{ place: homePlace(start), role: 'home', number: null, via: [] }] : []
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

/** How much longer a stretch you haven't mapped is assumed to be than the straight line (roads wind). */
const DETOUR = 1.3
const samePoint = (a: LngLat | null | undefined, b: LngLat) => !!a && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9
const metersBetween = (a: LngLat, b: LngLat) => distanceMeters({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] })

/**
 * From `a` (a point on the path so far) toward `b`: back along the path while that's the better way
 * there, then straight on. "Better" counts the unmapped stretch as DETOUR × its straight line, so a
 * known road wins over striking out across country. `path` is the ground travel so far in order,
 * with null where it breaks (a flight).
 */
function retrace(path: (LngLat | null)[], a: LngLat, b: LngLat): LngLat[] {
  let k = path.length - 1
  while (k >= 0 && !samePoint(path[k], a)) k--
  if (k < 0) return [a, b]
  let best = { cost: DETOUR * metersBetween(a, b), j: k, point: a }
  let along = 0
  for (let j = k; j > 0 && path[j - 1]; j--) {
    const [p, q] = [path[j]!, path[j - 1]!]
    const length = metersBetween(p, q)
    // Where to leave the path can be anywhere along a stretch, not just at its ends.
    for (let step = 1; step <= 10; step++) {
      const t = step / 10
      const point: LngLat = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      const cost = along + length * t + DETOUR * metersBetween(point, b)
      if (cost < best.cost) best = { cost, j, point }
    }
    along += length
  }
  if (best.point === a) return [a, b]
  const back = path.slice(best.j, k + 1).reverse() as LngLat[]
  return [...back, ...(samePoint(back.at(-1), best.point) ? [] : [best.point]), b]
}

/**
 * The line for each leg of a route (the one arriving at route[i]; null for the first point and for
 * flights, which are drawn as arcs). Legs you've shaped follow your bends. The rest follow the trip's
 * earlier ground path back as far as it helps, then head straight there: so the drive down from
 * Yosemite retraces the way up through Bakersfield and LA before turning off for Irvine.
 */
export function legPaths(route: RoutePoint[]): (LngLat[] | null)[] {
  const path: (LngLat | null)[] = []
  const at = (p: RoutePoint): LngLat => [p.place.lng, p.place.lat]
  return route.map((to, i) => {
    if (i === 0) return null
    const [a, b] = [at(route[i - 1]), at(to)]
    if (to.leg?.mode === 'flight') {
      path.push(null)
      return null
    }
    const line = to.via.length ? [a, ...to.via, b] : retrace(path, a, b)
    if (path.length && !samePoint(path.at(-1), a)) path.push(null)
    path.push(...(samePoint(path.at(-1), a) ? line.slice(1) : line))
    return line
  })
}

/**
 * How far a route goes by each way of traveling, in meters: drives along their drawn lines (so the
 * way back counts, retraced or not), flights in a straight line. Rough, since lines aren't roads.
 */
export function distancesByMode(route: RoutePoint[]): Partial<Record<NonNullable<RoutePoint['leg']>['mode'], number>> {
  const paths = legPaths(route)
  const out: Partial<Record<NonNullable<RoutePoint['leg']>['mode'], number>> = {}
  route.forEach((r, i) => {
    if (!r.leg) return
    const line = paths[i]
    const m = line ? line.slice(1).reduce((sum, p, k) => sum + metersBetween(line[k], p), 0) : r.leg.distanceM
    out[r.leg.mode] = (out[r.leg.mode] ?? 0) + m
  })
  return out
}
