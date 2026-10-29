import { distanceMeters } from './geo.ts'
import type { PlaceInput, PlaceRef } from './travelActions.ts'
import type { Place } from './types.ts'

/** A row of us-places.json: [name, USPS state, lat, lng, population (0 when unknown)]. */
export type TownRow = [string, string, number, number, number]

/** world-cities.json (GeoNames, outside the US): country names by code, and cities biggest first. */
export interface WorldCities {
  countries: Record<string, string>
  /** Continent code (AF, AN, AS, EU, NA, OC, SA) by country code. */
  continents: Record<string, string>
  /** [name, region (state / province), country code, lat, lng, population] */
  cities: [string, string, string, number, number, number][]
}
type CityRow = WorldCities['cities'][number]

/** Other ways people write a country, for narrowing a search ("Lisbon, Portugal", "london uk"). */
const COUNTRY_ALIASES: Record<string, string> = { usa: 'US', 'united states of america': 'US', america: 'US', uk: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', holland: 'NL' }

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

export function cityInput(row: CityRow): PlaceInput {
  const [name, , countryCode, lat, lng] = row
  // Regions outside the US aren't tracked yet, so no regionCode.
  return { name, lat, lng, city: name, countryCode, regionCode: null, parkId: null }
}

/** "Sintra" in Lisbon district: "Lisbon, Portugal"; "Porto" (its own region): "Portugal". */
const cityDetail = (row: CityRow, countries: Record<string, string>) => {
  const country = countries[row[2]] ?? row[2]
  return row[1] && normalize(row[1]) !== normalize(row[0]) ? `${row[1]}, ${country}` : country
}

const stateCodes = new WeakMap<TownRow[], Set<string>>()
const stateCodesOf = (towns: TownRow[]) => {
  let codes = stateCodes.get(towns)
  if (!codes) stateCodes.set(towns, (codes = new Set(towns.map((t) => t[1]))))
  return codes
}

/**
 * A trailing state or country narrows the search: "Springdale, UT" (US state codes come first,
 * so "CA" is California), "Lisbon, Portugal", "lisbon pt", "london uk".
 */
function narrowing(q: string, stateCodes: Set<string>, countries: Record<string, string>): { q: string; state: string | null; country: string | null } {
  const last = q.match(/^(.+?) ([a-z]{2})$/)
  if (last && stateCodes.has(last[2].toUpperCase())) return { q: last[1], state: last[2].toUpperCase(), country: 'US' }
  if (last && countries[last[2].toUpperCase()]) return { q: last[1], state: null, country: last[2].toUpperCase() }
  const names: [string, string][] = [...Object.entries(countries).map(([code, name]) => [normalize(name), code] as [string, string]), ...Object.entries(COUNTRY_ALIASES)]
  // Longest name first, so "south sudan" isn't read as "sudan".
  for (const [name, code] of names.sort((a, b) => b[0].length - a[0].length)) {
    if (q.length > name.length + 1 && q.endsWith(` ${name}`)) return { q: q.slice(0, -name.length - 1), state: null, country: code }
  }
  return { q, state: null, country: null }
}

export function parkInput(park: ParkInfo): PlaceInput {
  return { name: park.fullName, lat: park.lat, lng: park.lng, city: null, countryCode: 'US', regionCode: park.states[0] ?? null, parkId: park.id }
}

/**
 * Searches, in order: places you've been (so a repeat visit reuses the same pin), national parks,
 * then cities and towns, US and worldwide, bigger ones first. A trailing state or country narrows
 * it ("Springdale, UT", "Lisbon, Portugal"). With `near` (e.g. the trip's main destination), towns
 * close to it get a boost, so a small town nearby beats a bigger one far away, but not a city
 * many times its size ("Lisbon" on an Ohio trip is still Portugal's).
 */
export function searchPlaces(
  query: string,
  sources: { yours: Place[]; visits: Map<string, number>; parks: ParkInfo[]; towns: TownRow[]; world?: WorldCities | null },
  limit = 8,
  near: { lat: number; lng: number } | null = null,
): SearchResult[] {
  const typed = normalize(query)
  if (typed.length < 2) return []
  const countries = sources.world?.countries ?? {}
  const { q, state, country } = narrowing(typed, stateCodesOf(sources.towns), countries)

  type Ranked = SearchResult & { rank: number; distance: number; population: number }
  const results: Ranked[] = []
  const yourParks = new Set<string>()
  const yourTowns = new Set<string>()

  for (const p of sources.yours) {
    const s = score(p.name, q)
    if (s === null || (state && stateOf(p.regionCode) !== state) || (country && p.countryCode !== country)) continue
    if (p.parkId) yourParks.add(p.parkId)
    yourTowns.add(`${normalize(p.name)}|${p.countryCode === 'US' ? stateOf(p.regionCode) : p.countryCode}`)
    const visits = sources.visits.get(p.id) ?? 0
    const where = p.countryCode === 'US' ? stateOf(p.regionCode) : (countries[p.countryCode] ?? p.countryCode)
    results.push({
      key: `place:${p.id}`,
      kind: 'yours',
      label: p.name,
      detail: [visits ? `Been ${visits}×` : 'Saved place', where].filter(Boolean).join(' · '),
      isPark: p.parkId !== null,
      ref: { placeId: p.id },
      rank: s,
      distance: 0,
      population: 0,
    })
  }

  for (const park of sources.parks) {
    if (yourParks.has(park.id) || state || (country && country !== 'US')) continue
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
  for (const row of country && country !== 'US' ? [] : sources.towns) {
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
  for (const row of country === 'US' || !sources.world ? [] : sources.world.cities) {
    if (country && row[2] !== country) continue
    const s = score(row[0], q)
    if (s === null || s > 2 || yourTowns.has(`${normalize(row[0])}|${row[2]}`)) continue
    towns.push({
      key: `city:${row[0]}|${row[2]}|${row[3]}`,
      kind: 'town',
      label: row[0],
      detail: cityDetail(row, countries),
      isPark: false,
      ref: { place: cityInput(row) },
      rank: 20 + s,
      distance: near ? distanceMeters(near, { lat: row[3], lng: row[4] }) : Infinity,
      population: row[5],
    })
  }
  // Within a match tier (exact, starts with, a word starts with): by size on a log scale, with
  // towns near `near` counted as if 20× bigger. So "Portland" lists Oregon before Maine, but
  // Maine's on a Maine trip; a stop on a Zion trip finds St. George, Utah; and "Lisbon" is
  // Portugal's, far bigger than any US Lisbon, even on a trip near one.
  const NEARBY_M = 150_000
  const size = (t: Ranked) => Math.log10(Math.max(t.population, 1)) + (t.distance < NEARBY_M ? Math.log10(20) : 0)
  towns.sort(
    (a, b) =>
      a.rank - b.rank ||
      size(b) - size(a) ||
      a.distance - b.distance ||
      a.label.length - b.label.length ||
      a.label.localeCompare(b.label),
  )

  return [...results.sort((a, b) => a.rank - b.rank), ...towns].slice(0, limit).map(({ rank: _rank, distance: _distance, population: _population, ...r }) => r)
}
