import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import parksJson from '../data/national-parks.json'
import { containsPoint, distanceMeters } from './geo.ts'
import type { ParkInfo, TownRow, WorldCities } from './placeSearch.ts'
import type { PlaceInput } from './travelActions.ts'
import type { DistanceKind } from './types.ts'

/**
 * Bundled place data for search and for naming a dropped pin. The big files load on first use and
 * are cached by the service worker, so this all works offline.
 */

export const PARKS = parksJson as ParkInfo[]

type Area = Feature<Polygon | MultiPolygon, { id: string }>

let towns: Promise<TownRow[]> | null = null
export const loadTowns = () => (towns ??= import('../data/us-places.json').then((m) => m.default as unknown as TownRow[]))

let world: Promise<WorldCities> | null = null
/** Cities over 15,000 people outside the US, from GeoNames. */
export const loadWorldCities = () => (world ??= import('../data/world-cities.json').then((m) => m.default as unknown as WorldCities))

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

let countries: Promise<Area[]> | null = null
const loadCountries = () =>
  (countries ??= import('../data/world-countries.json').then((m) => {
    const topo = m.default as unknown as Topology<{ countries: GeometryCollection<{ iso: string }> }>
    return (feature(topo, topo.objects.countries).features as Feature<Polygon | MultiPolygon, { iso: string }>[]).map((f) => ({
      ...f,
      properties: { id: f.properties.iso },
    }))
  }))

/** Names a point outside the US: the city it's in or near (GeoNames), and its country. */
async function placeAbroad(lng: number, lat: number): Promise<PlaceInput | null> {
  const [areas, world] = await Promise.all([loadCountries(), loadWorldCities()])
  const country = areaAt(areas, lng, lat)
  if (!country || country === 'US' || country === '-99') return null
  let nearest: WorldCities['cities'][number] | null = null
  let nearestM = Infinity
  for (const row of world.cities) {
    if (Math.abs(row[3] - lat) > 0.5 || Math.abs(row[4] - lng) > 0.7) continue
    const m = distanceMeters({ lat: row[3], lng: row[4] }, { lat, lng })
    if (m < nearestM) [nearest, nearestM] = [row, m]
  }
  const town = nearest && nearestM < NEAR_TOWN_M ? nearest[0] : null
  const name = town ? (nearestM < IN_TOWN_M * 3 ? town : `Near ${town}`) : 'Dropped pin'
  return { name, lat, lng, city: town, countryCode: country, regionCode: null, parkId: null }
}

/** Names a point on the map: the national park it's in, else the town it's in or near. */
export async function placeAt(lng: number, lat: number): Promise<PlaceInput> {
  const [stateAreas, parks, rows] = await Promise.all([loadStates(), loadParkAreas(), loadTowns()])
  const regionCode = areaAt(stateAreas, lng, lat)
  if (!regionCode) {
    const abroad = await placeAbroad(lng, lat)
    if (abroad) return abroad
  }
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
  /** The hike's nps.gov page; null for trails that are on the NPS trails map but have no page. */
  npsUrl: string | null
  difficulty: 'Easy' | 'Moderate' | 'Strenuous' | null
  distanceMi: number | null
  /** How NPS states the distance; null when it doesn't say. */
  distanceKind?: DistanceKind | null
  /** "nps" = stated by the park; "osm" = length of the mapped trail, so approximate. */
  distanceSource: 'nps' | 'osm' | null
  /** NPS's time estimate, e.g. "1–2 hours". */
  duration: string | null
}

/** Whether a hike's name has every word typed so far ("sky lo" finds "Skyline Loop"). */
export const matchesHike = (name: string, query: string) => {
  const n = name.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((w) => n.includes(w))
}

let hikes: Promise<Record<string, NpsHike[]>> | null = null
/** Each park's hiking trails, from the NPS trails map and nps.gov (built by scripts/build-park-hikes.mjs). */
export const loadParkHikes = () => (hikes ??= import('../data/park-hikes.json').then((m) => m.default as Record<string, NpsHike[]>))

/** The national park a point falls in, if any (for "Is this Yosemite National Park?"). */
export async function parkAt(lng: number, lat: number): Promise<ParkInfo | null> {
  const id = areaAt(await loadParkAreas(), lng, lat)
  return (id && PARKS.find((p) => p.id === id)) || null
}

/** Park boundaries as GeoJSON, for the map's parks layer. */
export const loadParkBoundaries = () => loadParkAreas().then((features) => ({ type: 'FeatureCollection' as const, features }))
