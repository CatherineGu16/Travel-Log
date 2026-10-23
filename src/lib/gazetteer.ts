import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import parksJson from '../data/national-parks.json'
import { containsPoint, distanceMeters } from './geo.ts'
import type { ParkInfo, TownRow } from './placeSearch.ts'
import type { PlaceInput } from './travelActions.ts'

/**
 * Bundled place data for search and for naming a dropped pin. The big files load on first use and
 * are cached by the service worker, so this all works offline.
 */

export const PARKS = parksJson as ParkInfo[]

type Area = Feature<Polygon | MultiPolygon, { id: string }>

let towns: Promise<TownRow[]> | null = null
export const loadTowns = () => (towns ??= import('../data/us-places.json').then((m) => m.default as unknown as TownRow[]))

let states: Promise<Area[]> | null = null
const loadStates = () =>
  (states ??= import('../data/us-states.json').then((m) => {
    const topo = m.default as unknown as Topology<{ states: GeometryCollection<{ code: string }> }>
    return (feature(topo, topo.objects.states).features as Feature<Polygon | MultiPolygon, { code: string }>[]).map((f) => ({
      ...f,
      properties: { id: f.properties.code },
    }))
  }))

let parkAreas: Promise<Area[]> | null = null
const loadParkAreas = () =>
  (parkAreas ??= import('../data/park-boundaries.json').then((m) => {
    const topo = m.default as unknown as Topology<{ parks: GeometryCollection<{ id: string }> }>
    return feature(topo, topo.objects.parks).features as Area[]
  }))

const areaAt = (areas: Area[], lng: number, lat: number) => areas.find((a) => containsPoint(a.geometry, lng, lat))?.properties.id ?? null

/** Within this distance a dropped pin takes the town's name; farther out it's "Near <town>". */
const IN_TOWN_M = 3000
const NEAR_TOWN_M = 40000

/** Names a point on the map: the national park it's in, else the town it's in or near. */
export async function placeAt(lng: number, lat: number): Promise<PlaceInput> {
  const [stateAreas, parks, rows] = await Promise.all([loadStates(), loadParkAreas(), loadTowns()])
  const regionCode = areaAt(stateAreas, lng, lat)
  const parkId = areaAt(parks, lng, lat)
  let nearest: TownRow | null = null
  let nearestM = Infinity
  for (const row of rows) {
    // Cheap box check first: 32k rows, most of them far away.
    if (Math.abs(row[2] - lat) > 0.5 || Math.abs(row[3] - lng) > 0.7) continue
    const m = distanceMeters({ lat: row[2], lng: row[3] }, { lat, lng })
    if (m < nearestM) [nearest, nearestM] = [row, m]
  }
  const park = parkId ? PARKS.find((p) => p.id === parkId) : undefined
  const town = nearest && nearestM < NEAR_TOWN_M ? nearest[0] : null
  const name = park ? park.fullName : town ? (nearestM < IN_TOWN_M ? town : `Near ${town}`) : 'Dropped pin'
  return { name, lat, lng, city: town, countryCode: 'US', regionCode, parkId: parkId ?? null }
}

export interface NpsHike {
  id: string
  name: string
  npsUrl: string
}

let hikes: Promise<Record<string, NpsHike[]>> | null = null
/** The hikes each park lists on nps.gov (names and links only). */
export const loadParkHikes = () => (hikes ??= import('../data/park-hikes.json').then((m) => m.default as Record<string, NpsHike[]>))

/** The national park a point falls in, if any (for "Is this Yosemite National Park?"). */
export async function parkAt(lng: number, lat: number): Promise<ParkInfo | null> {
  const id = areaAt(await loadParkAreas(), lng, lat)
  return (id && PARKS.find((p) => p.id === id)) || null
}

/** Park boundaries as GeoJSON, for the map's parks layer. */
export const loadParkBoundaries = () => loadParkAreas().then((features) => ({ type: 'FeatureCollection' as const, features }))
