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

/**
 * How much a stretch not traveled yet counts against one already traveled, per mile. High, because
 * the stops you add on the way back (food, gas) are usually along the way you came, and the drawn
 * way there stands in for the road: so the line keeps to it and only leaves it to reach a stop.
 */
const DETOUR = 3
/** Only use roads already traveled when that saves at least this much, so a tiny gain doesn't add a wiggle. */
const WORTH_IT = 0.95
const metersBetween = (a: LngLat, b: LngLat) => distanceMeters({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] })
const samePoint = (a: LngLat | undefined, b: LngLat) => !!a && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9

/** Points along a stretch of road already traveled, every tenth of each piece, with the distance along it. */
function samplesOf(chain: LngLat[]) {
  const out: { point: LngLat; piece: number; along: number }[] = []
  let along = 0
  for (let k = 0; k < chain.length - 1; k++) {
    const [p, q] = [chain[k], chain[k + 1]]
    const length = metersBetween(p, q)
    for (let step = 0; step < 10; step++) {
      const t = step / 10
      out.push({ point: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], piece: k, along: along + length * t })
    }
    along += length
  }
  out.push({ point: chain.at(-1)!, piece: chain.length - 1, along })
  return out
}

/**
 * The way from `a` to `b`, using roads already traveled on this trip where that's the better way:
 * straight onto a traveled stretch, along it (either direction), and straight off it to `b`. A
 * stretch not traveled yet counts as DETOUR × its straight line, so the known way wins over striking
 * out across country. So the drive down from Yosemite keeps to the way up from LA until it turns
 * off for a stop in Fresno, and the drive on from Fresno rejoins it.
 */
function viaTraveled(traveled: LngLat[][], a: LngLat, b: LngLat): LngLat[] {
  const direct = DETOUR * metersBetween(a, b)
  let best = { cost: direct * WORTH_IT, line: [a, b] }
  for (const chain of traveled) {
    if (chain.length < 2) continue
    const samples = samplesOf(chain)
    const on = samples.map((x) => DETOUR * metersBetween(a, x.point))
    const off = samples.map((x) => DETOUR * metersBetween(x.point, b))
    // Joining at j and leaving at d costs on[j] + |along[d] − along[j]| + off[d]. Going forward
    // (j ≤ d), the best j for each d is a running minimum of on[j] − along[j]; backward, of on[j] + along[j].
    let forward = { value: Infinity, j: 0 }
    for (let d = 0; d < samples.length; d++) {
      if (on[d] - samples[d].along < forward.value) forward = { value: on[d] - samples[d].along, j: d }
      const cost = forward.value + samples[d].along + off[d]
      if (cost < best.cost) best = { cost, line: lineAlong(chain, samples, forward.j, d, a, b) }
    }
    let backward = { value: Infinity, j: samples.length - 1 }
    for (let d = samples.length - 1; d >= 0; d--) {
      if (on[d] + samples[d].along < backward.value) backward = { value: on[d] + samples[d].along, j: d }
      const cost = backward.value - samples[d].along + off[d]
      if (cost < best.cost) best = { cost, line: lineAlong(chain, samples, backward.j, d, a, b) }
    }
  }
  return best.line
}

/** a → onto the chain at sample j → along it → off at sample d → b, without repeated points. */
function lineAlong(chain: LngLat[], samples: ReturnType<typeof samplesOf>, j: number, d: number, a: LngLat, b: LngLat): LngLat[] {
  const [from, to] = [samples[j], samples[d]]
  const corners =
    j <= d
      ? chain.slice(from.piece + 1, to.piece + 1)
      : chain.slice(to.piece + 1, from.piece + 1).reverse()
  const line: LngLat[] = []
  for (const p of [a, from.point, ...corners, to.point, b]) if (!samePoint(line.at(-1), p)) line.push(p)
  return line
}

/**
 * The line for each leg of a route (the one arriving at route[i]; null for the first point and for
 * flights, which are drawn as arcs). Legs you've shaped follow your bends. The rest use roads already
 * traveled on the trip where that's the better way (see viaTraveled): the drive down from Yosemite
 * retraces the way up through Bakersfield before turning off for Irvine, and stops on the way home
 * (food, gas) don't stop the rest of the drive following the way you came.
 */
export function legPaths(route: RoutePoint[]): (LngLat[] | null)[] {
  // Ground travel so far, as unbroken stretches (a flight starts a new one).
  const traveled: LngLat[][] = []
  const at = (p: RoutePoint): LngLat => [p.place.lng, p.place.lat]
  return route.map((to, i) => {
    if (i === 0) return null
    const [a, b] = [at(route[i - 1]), at(to)]
    if (to.leg?.mode === 'flight') {
      traveled.push([])
      return null
    }
    const line = to.via.length ? [a, ...to.via, b] : viaTraveled(traveled, a, b)
    const current = traveled.at(-1)
    if (current && samePoint(current.at(-1), a)) current.push(...line.slice(1))
    else traveled.push([...line])
    return line
  })
}

/**
 * Bends that make the leg arriving at route[i] follow the way already traveled: from where it starts,
 * along the drawn route so far to the point on it closest to where it's going, then straight there.
 * For "Follow the way you came" while shaping a leg. Null when the leg doesn't start on a traveled
 * stretch (the trip's first leg, or right after a flight) or there's nothing to follow.
 */
export function followTraveledBends(route: RoutePoint[], i: number): LngLat[] | null {
  if (i < 2) return null
  const at = (p: RoutePoint): LngLat => [p.place.lng, p.place.lat]
  const [a, b] = [at(route[i - 1]), at(route[i])]
  // The ground travel before this leg, as unbroken stretches (a flight starts a new one).
  const chains: LngLat[][] = []
  legPaths(route.slice(0, i)).forEach((line, k) => {
    if (k === 0) return
    if (!line) return void chains.push([])
    const current = chains.at(-1)
    if (current && samePoint(current.at(-1), line[0])) current.push(...line.slice(1))
    else chains.push([...line])
  })
  let best: { line: LngLat[]; off: number } | null = null
  for (const chain of chains) {
    if (chain.length < 2) continue
    const samples = samplesOf(chain)
    const nearest = (p: LngLat) => samples.reduce((m, x, k) => (metersBetween(x.point, p) < metersBetween(samples[m].point, p) ? k : m), 0)
    const [j, d] = [nearest(a), nearest(b)]
    // The leg has to start on this stretch to follow it.
    if (metersBetween(samples[j].point, a) > 1000 || j === d) continue
    const off = metersBetween(samples[d].point, b)
    if (!best || off < best.off) best = { line: lineAlong(chain, samples, j, d, a, b), off }
  }
  const bends = best?.line.slice(1, -1) ?? []
  return bends.length ? bends : null
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
