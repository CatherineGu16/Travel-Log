import { LngLatBounds } from 'maplibre-gl'
import { greatCircle, unwrapLngs } from '../lib/geo.ts'
import { legPaths, type RoutePoint } from '../lib/route.ts'
import type { LngLat } from '../lib/types.ts'

/** How a leg is drawn: a flight as a dashed arc, "not sure" (or a leg being shaped) dotted, the rest solid. */
export const legStyle = (to: RoutePoint) => (!to.leg || to.leg.mode === 'unknown' ? 'unknown' : to.leg.mode === 'flight' ? 'flight' : 'ground')

/** A flight arriving at `to`: along great circles, through any bends. (Ground legs come from legPaths.) */
function flightArc(from: RoutePoint, to: RoutePoint): LngLat[] {
  const points: LngLat[] = [[from.place.lng, from.place.lat], ...to.via, [to.place.lng, to.place.lat]]
  return points.slice(1).flatMap((p, i) => greatCircle(points[i], p).slice(i === 0 ? 0 : 1))
}

/**
 * The `route` source's data: each leg's line, a marker for each stop, and (while shaping) the bends,
 * numbered so they can be dragged, with the rest of the trip faintly behind.
 */
export function routeCollection(route: RoutePoint[], showBends = false, context: LngLat[][] = []): GeoJSON.FeatureCollection {
  const paths = legPaths(route)
  return {
    type: 'FeatureCollection',
    features: [
      ...context.map((coordinates) => ({
        type: 'Feature' as const,
        properties: { style: 'context' },
        geometry: { type: 'LineString' as const, coordinates: unwrapLngs(coordinates) },
      })),
      ...route.slice(1).map((r, i) => ({
        type: 'Feature' as const,
        properties: { style: legStyle(r) },
        geometry: { type: 'LineString' as const, coordinates: unwrapLngs(paths[i + 1] ?? flightArc(route[i], r)) },
      })),
      // Home starts and ends the trip at the same spot: one marker.
      ...route
        .filter((r, i) => r.number !== null || r.marker || (r.role === 'home' && i === 0))
        .map((r) => ({
          type: 'Feature' as const,
          properties: { number: r.marker ?? r.number ?? 'H', name: r.place.name },
          geometry: { type: 'Point' as const, coordinates: [r.place.lng, r.place.lat] },
        })),
      // Bends: small dots while you're shaping the route, so you can see what you tapped.
      ...(showBends ? route.flatMap((r) => r.via) : []).map((coordinates, index) => ({
        type: 'Feature' as const,
        properties: { bend: true, index },
        geometry: { type: 'Point' as const, coordinates },
      })),
    ],
  }
}

/**
 * What to fit the map to for a route: the places (and the bends of ground legs), not flight arcs,
 * so a long flight can run off the edge while the places stay readable. Home is left out when you
 * flew from it. Empty when there's nothing to fit.
 */
export function routeBounds(route: RoutePoint[]): LngLatBounds {
  const bounds = new LngLatBounds()
  const flewFrom = (i: number) => [route[i]?.leg, route[i + 1]?.leg].every((l) => !l || l.mode === 'flight')
  route.forEach((r, i) => {
    if (r.role === 'home' && flewFrom(i)) return
    if (legStyle(r) !== 'flight') for (const p of r.via) bounds.extend(p)
    bounds.extend([r.place.lng, r.place.lat])
  })
  return bounds
}
