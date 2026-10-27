import type { MultiPolygon, Polygon, Position } from 'geojson'

const EARTH_RADIUS_M = 6371e3
const toRad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in meters. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x))
}

function inRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Point-in-polygon for a (multi)polygon, respecting holes. */
export function containsPoint(geometry: Polygon | MultiPolygon, lng: number, lat: number): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(([outer, ...holes]) => inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h)))
}

/** Longitudes made continuous (179 then -179 becomes 179 then 181), so a line crossing the antimeridian draws the short way. */
export function unwrapLngs(line: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [lng, lat] of line) {
    const prev = out.at(-1)?.[0]
    out.push([prev === undefined ? lng : lng + 360 * Math.round((prev - lng) / 360), lat])
  }
  return out
}

/** Points along the great circle (the shortest path on the globe) from a to b, [lng, lat]. */
export function greatCircle(a: [number, number], b: [number, number], steps = 64): [number, number][] {
  const vec = ([lng, lat]: [number, number]) => [Math.cos(toRad(lat)) * Math.cos(toRad(lng)), Math.cos(toRad(lat)) * Math.sin(toRad(lng)), Math.sin(toRad(lat))]
  const [p, q] = [vec(a), vec(b)]
  const angle = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])))
  if (angle < 1e-6) return [a, b]
  const toDeg = (r: number) => (r * 180) / Math.PI
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const s = Math.sin((1 - f) * angle) / Math.sin(angle)
    const t = Math.sin(f * angle) / Math.sin(angle)
    const [x, y, z] = [0, 1, 2].map((k) => s * p[k] + t * q[k])
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))])
  }
  return unwrapLngs(points)
}
