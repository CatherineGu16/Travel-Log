import { distanceMeters } from './geo.ts'
import type { Home, LegMode, LngLat, Place, TravelData, Trip } from './types.ts'

/** Leg modes in the order the picker shows them, with the icon and label used everywhere. */
export const LEG_MODES: { id: LegMode; label: string; icon: string }[] = [
  { id: 'drive', label: 'Drive', icon: '🚗' },
  { id: 'flight', label: 'Flight', icon: '✈️' },
  { id: 'train', label: 'Train', icon: '🚆' },
  { id: 'cruise', label: 'Cruise', icon: '🚢' },
  { id: 'boat', label: 'Ferry or boat', icon: '⛴️' },
  { id: 'walk', label: 'Walk', icon: '🥾' },
  { id: 'unknown', label: 'Not sure', icon: '❔' },
]

export const isLegMode = (v: unknown): v is LegMode => LEG_MODES.some((m) => m.id === v)
export const legModeInfo = (mode: LegMode) => LEG_MODES.find((m) => m.id === mode)!

/** Farther than this in a straight line, a leg is guessed to be a flight; closer, a drive. */
export const FLIGHT_GUESS_M = 250 * 1609.344

/** The place id that stands for home in legs. Real ids never clash. */
export const HOME_ID = 'home'

export interface LegEnd {
  /** A place id, or HOME_ID. */
  id: string
  name: string
  lat: number
  lng: number
}

export interface Leg {
  from: LegEnd
  to: LegEnd
  /** Bends on the way (see Destination.via). */
  via: LngLat[]
  mode: LegMode
  /** True when nobody picked the mode for this leg. */
  guessed: boolean
  /** Straight-line distance through the bends. */
  distanceM: number
  /** Between two stops; from or back to home; or retracing an earlier leg on the way back. */
  role: 'stop' | 'home' | 'return'
}

/** Modes you've picked, by the two places (either direction). The most recently edited trip wins. */
export type LegMemory = Map<string, LegMode>

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

const memoryCache = new WeakMap<TravelData, LegMemory>()

/** Your picked leg modes across all trips, so a route you've corrected once is guessed right after. */
export function legMemory(data: TravelData): LegMemory {
  const cached = memoryCache.get(data)
  if (cached) return cached
  const out: LegMemory = new Map()
  const trips = data.trips.filter((t) => !t.deleted).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  for (const t of trips) {
    t.destinations.forEach((d, i) => {
      if (i > 0 && d.legMode) out.set(pairKey(t.destinations[i - 1].placeId, d.placeId), d.legMode)
    })
  }
  memoryCache.set(data, out)
  return out
}

/** The mode you last picked for these two places, else a flight if they're far apart, else a drive. */
export function guessMode(from: LegEnd, to: LegEnd, memory?: LegMemory): LegMode {
  return memory?.get(pairKey(from.id, to.id)) ?? (distanceMeters(from, to) > FLIGHT_GUESS_M ? 'flight' : 'drive')
}

export function makeLeg(from: LegEnd, to: LegEnd, via: LngLat[], picked: LegMode | null, memory?: LegMemory): Leg {
  const points = [from, ...via.map(([lng, lat]) => ({ lng, lat })), to]
  const distanceM = points.slice(1).reduce((sum, p, i) => sum + distanceMeters(points[i], p), 0)
  return { from, to, via, mode: picked ?? guessMode(from, to, memory), guessed: !picked, distanceM, role: 'stop' }
}

/** The way from or back to home: always a drive (home legs only exist when you drove). */
export const homeLeg = (from: LegEnd, to: LegEnd): Leg => ({ ...makeLeg(from, to, [], 'drive'), role: 'home' })

/** The legs back through the same stops: each outbound leg reversed, same bends and mode. */
export const returnLegs = (legs: Leg[]): Leg[] =>
  [...legs].reverse().map((l) => ({ ...l, from: l.to, to: l.from, via: [...l.via].reverse(), role: 'return' as const }))

export const endOfPlace = (p: Pick<Place, 'id' | 'name' | 'lat' | 'lng'>): LegEnd => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })
export const endOfHome = (h: Home): LegEnd => ({ id: HOME_ID, name: h.name, lat: h.lat, lng: h.lng })

/**
 * Every leg of a trip in order: from home (when you drove from home), between each pair of
 * destinations, back through them the same way (when you did), and back home. Destinations whose
 * place is missing are skipped.
 */
export function legsOf(trip: Trip, data: Pick<TravelData, 'places' | 'home'>, memory?: LegMemory): Leg[] {
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const stops = trip.destinations.flatMap((d) => {
    const p = byId.get(d.placeId)
    return p ? [{ end: endOfPlace(p), d }] : []
  })
  const out = stops.slice(1).map(({ end, d }, i) => makeLeg(stops[i].end, end, d.via, d.legMode, memory))
  const legs = trip.returnSameWay ? [...out, ...returnLegs(out)] : out
  const home = data.home && !data.home.deleted ? endOfHome(data.home) : null
  if (!home || !trip.fromHome || !stops.length) return legs
  // Back home from wherever the trip ended: the first stop when you came back the same way.
  const end = legs.at(-1)?.to ?? stops[0].end
  return [homeLeg(home, stops[0].end), ...legs, homeLeg(end, home)]
}

/** A trip that's all drives is a road trip; a cruise anywhere makes it a cruise. Never stored. */
export type TripKind = 'road-trip' | 'cruise'

export function tripKind(legs: Leg[]): TripKind | null {
  if (legs.some((l) => l.mode === 'cruise')) return 'cruise'
  if (legs.length && legs.every((l) => l.mode === 'drive')) return 'road-trip'
  return null
}

/** The Filter sheet's "How you traveled" choices, worked out from the legs. */
export type ModeFilter = 'road-trip' | 'flight' | 'cruise'

export const MODE_FILTERS: { id: ModeFilter; label: string; icon: string; hint: string }[] = [
  { id: 'road-trip', label: 'Road trip', icon: '🚗', hint: 'Every leg a drive' },
  { id: 'flight', label: 'Flight', icon: '✈️', hint: 'Any leg a flight' },
  { id: 'cruise', label: 'Cruise', icon: '🚢', hint: 'Any leg a cruise' },
]

export function matchesMode(legs: Leg[], f: ModeFilter): boolean {
  return f === 'flight' ? legs.some((l) => l.mode === 'flight') : tripKind(legs) === f
}

/** "1,240 mi". */
export function formatDistance(m: number): string {
  const mi = m / 1609.344
  if (mi < 1) return '<1 mi'
  return `${Math.round(mi).toLocaleString('en-US')} mi`
}
