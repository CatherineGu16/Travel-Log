import { distanceMeters } from './geo.ts'
import type { PlaceInput, PlaceRef } from './travelActions.ts'
import type { Place } from './types.ts'

/** A row of us-places.json: [name, USPS state, lat, lng, population (0 when unknown)]. */
export type TownRow = [string, string, number, number, number]

export interface ParkInfo {
  id: string
  name: string
  fullName: string
  states: string[]
  lat: number
  lng: number
}

export interface SearchResult {
  key: string
  /** "online" results come from Photon, only with the detailed map on. */
  kind: 'yours' | 'park' | 'town' | 'online'
  label: string
  detail: string
  isPark: boolean
  ref: PlaceRef
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’ʻ.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** 0 exact, 1 starts with, 2 a word starts with, 3 contains, null no match. */
function score(name: string, q: string): number | null {
  const n = normalize(name)
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (n.includes(` ${q}`)) return 2
  if (n.includes(q)) return 3
  return null
}

const stateOf = (regionCode: string | null) => regionCode?.replace(/^US-/, '') ?? ''

export function townInput(row: TownRow): PlaceInput {
  const [name, state, lat, lng] = row
  return { name, lat, lng, city: name, countryCode: 'US', regionCode: `US-${state}`, parkId: null }
}

export function parkInput(park: ParkInfo): PlaceInput {
  return { name: park.fullName, lat: park.lat, lng: park.lng, city: null, countryCode: 'US', regionCode: park.states[0] ?? null, parkId: park.id }
}

/**
 * Searches, in order: places you've been (so a repeat visit reuses the same pin), national parks,
 * then US cities and towns, bigger ones first. "Springdale, UT" or "springdale ut" narrows towns
 * to a state. With `near` (e.g. the trip's main destination), towns close to it come first.
 */
export function searchPlaces(
  query: string,
  sources: { yours: Place[]; visits: Map<string, number>; parks: ParkInfo[]; towns: TownRow[] },
  limit = 8,
  near: { lat: number; lng: number } | null = null,
): SearchResult[] {
  let q = normalize(query)
  if (q.length < 2) return []
  let state: string | null = null
  const withState = q.match(/^(.+?) ([a-z]{2})$/)
  if (withState && sources.towns.some((t) => t[1] === withState[2].toUpperCase())) {
    q = withState[1]
    state = withState[2].toUpperCase()
  }

  type Ranked = SearchResult & { rank: number; distance: number; population: number }
  const results: Ranked[] = []
  const yourParks = new Set<string>()
  const yourTowns = new Set<string>()

  for (const p of sources.yours) {
    const s = score(p.name, q)
    if (s === null || (state && stateOf(p.regionCode) !== state)) continue
    if (p.parkId) yourParks.add(p.parkId)
    yourTowns.add(`${normalize(p.name)}|${stateOf(p.regionCode)}`)
    const visits = sources.visits.get(p.id) ?? 0
    results.push({
      key: `place:${p.id}`,
      kind: 'yours',
      label: p.name,
      detail: [visits ? `Been ${visits}×` : 'Saved place', stateOf(p.regionCode)].filter(Boolean).join(' · '),
      isPark: p.parkId !== null,
      ref: { placeId: p.id },
      rank: s,
      distance: 0,
      population: 0,
    })
  }

  for (const park of sources.parks) {
    if (yourParks.has(park.id) || state) continue
    const s = Math.min(score(park.name, q) ?? 9, score(park.fullName, q) ?? 9)
    if (s === 9) continue
    results.push({
      key: `park:${park.id}`,
      kind: 'park',
      label: park.fullName,
      detail: `National park · ${park.states.map((r) => r.replace(/^US-/, '')).join(', ')}`,
      isPark: true,
      ref: { place: parkInput(park) },
      rank: 10 + s,
      distance: 0,
      population: 0,
    })
  }

  const towns: Ranked[] = []
  for (const row of sources.towns) {
    if (state && row[1] !== state) continue
    const s = score(row[0], q)
    if (s === null || s > 2 || yourTowns.has(`${normalize(row[0])}|${row[1]}`)) continue
    const distance = near ? distanceMeters(near, { lat: row[2], lng: row[3] }) : Infinity
    towns.push({
      key: `town:${row[0]}|${row[1]}|${row[2]}`,
      kind: 'town',
      label: row[0],
      detail: row[1],
      isPark: false,
      ref: { place: townInput(row) },
      rank: 20 + s,
      distance,
      population: row[4] ?? 0,
    })
  }
  // Within a match tier (exact, starts with, a word starts with): towns near `near` first,
  // nearest first; then the biggest. So "Portland" lists Oregon before Maine, and a stop on a
  // Zion trip finds St. George, Utah.
  const NEARBY_M = 150_000
  towns.sort(
    (a, b) =>
      a.rank - b.rank ||
      Number(b.distance < NEARBY_M) - Number(a.distance < NEARBY_M) ||
      (a.distance < NEARBY_M && b.distance < NEARBY_M ? a.distance - b.distance : 0) ||
      b.population - a.population ||
      a.label.length - b.label.length ||
      a.label.localeCompare(b.label),
  )

  return [...results.sort((a, b) => a.rank - b.rank), ...towns].slice(0, limit).map(({ rank: _rank, distance: _distance, population: _population, ...r }) => r)
}
