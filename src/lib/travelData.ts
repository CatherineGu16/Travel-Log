import { isPartialDate } from './partialDate.ts'
import { insertCheapest } from './route.ts'
import { isLegMode } from './legs.ts'
import { asList, builtInGroups } from './travelActions.ts'
import { FAMILY_GROUP_ID, FRIENDS_GROUP_ID, type Avatar, type Destination, type Group, type HikeEdit, type Home, type HomeMode, type LegMode, type LngLat, type Person, type Place, type Synced, type TravelData, type Trip, type TripStart } from './types.ts'

/**
 * Combines two copies of your data record by record: the newer updatedAt wins, and deletes travel
 * as tombstones. Used by GitHub sync and by Import (merge).
 */
export function mergeData(a: TravelData, b: TravelData): TravelData {
  return {
    schemaVersion: 1,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    trips: newestById(a.trips, b.trips),
    places: newestById(a.places, b.places),
    people: newestById(a.people, b.people),
    groups: newestById(a.groups, b.groups),
    hikeEdits: newestById(a.hikeEdits, b.hikeEdits),
    home: newestById(asList(a.home), asList(b.home))[0] ?? null,
  }
}

/** Per id, the newer updatedAt wins; on a tie, a delete wins so it can't be undone by an older copy. */
function newestById<T extends Synced>(xs: T[], ys: T[]): T[] {
  const out = new Map<string, T>()
  for (const x of [...xs, ...ys]) {
    const have = out.get(x.id)
    if (!have || x.updatedAt > have.updatedAt || (x.updatedAt === have.updatedAt && x.deleted)) out.set(x.id, x)
  }
  return [...out.values()]
}

/** JSON with object keys sorted, so two copies built in different orders compare equal. */
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(v)

/** Content equality, ignoring record order, key order and the top-level timestamp. */
export function sameContent(a: TravelData, b: TravelData): boolean {
  const canon = (d: TravelData) => stable([d.trips, d.places, d.people, d.groups, d.hikeEdits, asList(d.home)].map((records) => [...records].sort((x, y) => x.id.localeCompare(y.id))))
  return canon(a) === canon(b)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** A [lng, lat] pair that is on the map. */
const isLngLat = (v: unknown): v is LngLat =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
const dateOrNull = (v: unknown) => (typeof v === 'string' && isPartialDate(v) ? v : null)
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** The parts every synced record needs; records without them are dropped rather than breaking the app. */
function synced(o: Record<string, unknown>): Synced | null {
  if (typeof o.id !== 'string' || typeof o.updatedAt !== 'string') return null
  return { id: o.id, createdAt: str(o.createdAt, o.updatedAt), updatedAt: o.updatedAt, ...(o.deleted === true ? { deleted: true } : {}) }
}

function parseAvatar(v: unknown): Avatar {
  const o = isObject(v) ? v : {}
  const kind = o.kind === 'emoji' || o.kind === 'photo' ? o.kind : 'initials'
  return {
    kind,
    color: str(o.color, '#2b6f8f'),
    emoji: typeof o.emoji === 'string' ? o.emoji : null,
    photoUpdatedAt: typeof o.photoUpdatedAt === 'string' ? o.photoUpdatedAt : null,
  }
}

/** Checks a travel.json (from GitHub or an Import) before it can touch your data. */
export function parseTravelData(input: unknown): TravelData {
  const fail = (msg: string): never => {
    throw new Error(`This doesn't look like Travel Log data: ${msg}`)
  }
  if (!isObject(input)) fail('not a JSON object')
  const o = input as Record<string, unknown>
  if (o.schemaVersion !== 1) fail('unknown version')
  for (const key of ['trips', 'places', 'people', 'groups']) if (!Array.isArray(o[key])) fail(`missing ${key}`)

  const records = <T,>(key: string, build: (x: Record<string, unknown>, base: Synced) => T | null): T[] =>
    (o[key] as unknown[]).flatMap((x) => {
      if (!isObject(x)) return []
      const base = synced(x)
      const built = base && build(x, base)
      return built ? [built] : []
    })

  const places = records<Place>('places', (x, base) =>
    typeof x.lat === 'number' && typeof x.lng === 'number'
      ? {
          ...base,
          name: str(x.name, 'Unnamed place'),
          lat: x.lat,
          lng: x.lng,
          city: typeof x.city === 'string' ? x.city : null,
          countryCode: str(x.countryCode, 'US'),
          regionCode: typeof x.regionCode === 'string' ? x.regionCode : null,
          parkId: typeof x.parkId === 'string' ? x.parkId : null,
        }
      : null,
  )

  const placeById = new Map(places.map((p) => [p.id, p]))
  const destinationOf = (d: Record<string, unknown>, isMain: boolean): Destination => ({
    placeId: d.placeId as string,
    isMain,
    startDate: dateOrNull(d.startDate),
    endDate: dateOrNull(d.endDate),
    note: str(d.note),
    via: Array.isArray(d.via) ? d.via.filter(isLngLat).map(([lng, lat]) => [lng, lat] as LngLat) : [],
    legMode: isLegMode(d.legMode) ? d.legMode : null,
  })

  /**
   * Trips saved before destinations: a main place plus stops. The main place is slotted into the
   * stops where it adds the least distance, which is how the map drew those routes.
   */
  const fromMainAndStops = (x: Record<string, unknown>): Destination[] | null => {
    if (typeof x.mainPlaceId !== 'string') return null
    const stops = (Array.isArray(x.stops) ? x.stops : [])
      .filter((s): s is Record<string, unknown> => isObject(s) && typeof s.placeId === 'string')
      .map((s) => destinationOf(s, false))
    const listed = stops.find((d) => d.placeId === x.mainPlaceId)
    if (listed) {
      listed.isMain = true
      return stops
    }
    const main: Destination = { placeId: x.mainPlaceId, isMain: true, startDate: null, endDate: null, note: '', via: [], legMode: null }
    const at = (d: Destination) => placeById.get(d.placeId) ?? { lat: 0, lng: 0 }
    const located = stops.map((d) => ({ ...at(d), d }))
    return insertCheapest(located, { ...at(main), d: main }).map((l) => l.d)
  }

  const trips = records<Trip>('trips', (x, base) => {
    const startDate = dateOrNull(x.startDate)
    if (!startDate) return null
    const destinations = Array.isArray(x.destinations)
      ? x.destinations
          .filter((d): d is Record<string, unknown> => isObject(d) && typeof d.placeId === 'string')
          .map((d) => destinationOf(d, d.isMain === true))
      : fromMainAndStops(x)
    if (!destinations?.length) return null
    if (!destinations.some((d) => d.isMain)) destinations[0].isMain = true
    destinations[0].legMode = null
    // Trips saved with one "how you traveled" for the whole trip: carried over onto the legs, and a
    // road trip was driven from home, a flight flown. Versions since stored whether the trip was
    // from home as a yes/no, a mode each way, or a mode; those trips follow Home (no `start` yet).
    const pick = (mode: LegMode) => destinations.forEach((d, i) => i > 0 && !d.legMode && (d.legMode = mode))
    if (x.travelMode === 'road-trip') pick('drive')
    else if (x.travelMode === 'cruise') pick('cruise')
    const each = isObject(x.homeLegs) ? (x.homeLegs.to === 'flight' || x.homeLegs.back === 'flight' ? 'flight' : 'drive') : null
    const earlier: HomeMode | null =
      x.fromHome === 'drive' || x.fromHome === 'flight'
        ? x.fromHome
        : x.fromHome === true || x.travelMode === 'road-trip'
          ? 'drive'
          : x.travelMode === 'flight'
            ? 'flight'
            : each
    const homeMode: HomeMode = x.homeMode === 'drive' || x.homeMode === 'flight' ? x.homeMode : (earlier ?? 'flight')
    const s = isObject(x.start) ? x.start : null
    const start: TripStart | null | undefined =
      s && typeof s.lat === 'number' && typeof s.lng === 'number' && isLngLat([s.lng, s.lat])
        ? { name: str(s.name, 'Home'), lat: s.lat, lng: s.lng }
        : 'start' in x || !earlier
          ? null
          : undefined
    return {
      ...base,
      title: str(x.title, 'Trip'),
      startDate,
      endDate: dateOrNull(x.endDate),
      approximate: x.approximate === true,
      destinations,
      companions: strings(x.companions),
      companionGroupIds: [
        ...new Set([
          ...strings(x.companionGroupIds),
          // Trips marked with the earlier Family switch or Family / Friends type keep it as a tag.
          ...(x.isFamily === true || x.tripType === 'family' ? [FAMILY_GROUP_ID] : []),
          ...(x.tripType === 'friends' ? [FRIENDS_GROUP_ID] : []),
        ]),
      ],
      hikes: (Array.isArray(x.hikes) ? x.hikes : [])
        .filter((h): h is Record<string, unknown> => isObject(h) && typeof h.parkId === 'string' && typeof h.name === 'string')
        .map((h) => ({ parkId: h.parkId as string, hikeId: typeof h.hikeId === 'string' ? h.hikeId : null, name: h.name as string, date: dateOrNull(h.date) })),
      homeMode,
      ...(start === undefined ? {} : { start }),
      returnSameWay: x.returnSameWay === true && destinations.length > 1,
      description: str(x.description),
      highlights: str(x.highlights),
      rating: typeof x.rating === 'number' && x.rating >= 1 && x.rating <= 5 ? Math.round(x.rating) : null,
      tags: strings(x.tags),
    }
  })

  const people = records<Person>('people', (x, base) => ({ ...base, name: str(x.name, 'Someone'), avatar: parseAvatar(x.avatar) }))

  const groups = records<Group>('groups', (x, base) => ({
    ...base,
    name: str(x.name, 'Group'),
    memberIds: strings(x.memberIds),
    isFamily: base.id === FAMILY_GROUP_ID,
  }))
  // Every copy has the built-in Family and Friends groups, even an old or hand-made file.
  for (const g of builtInGroups()) if (!groups.some((x) => x.id === g.id)) groups.push(g)

  // Added later: older files have none.
  if (!Array.isArray(o.hikeEdits)) o.hikeEdits = []
  const hikeEdits = records<HikeEdit>('hikeEdits', (x, base) =>
    typeof x.parkId === 'string' && typeof x.hikeId === 'string' && typeof x.name === 'string'
      ? {
          ...base,
          parkId: x.parkId,
          hikeId: x.hikeId,
          name: x.name,
          distanceMi: typeof x.distanceMi === 'number' && Number.isFinite(x.distanceMi) && x.distanceMi >= 0 ? x.distanceMi : null,
          distanceKind: x.distanceKind === 'round trip' || x.distanceKind === 'one way' || x.distanceKind === 'loop' ? x.distanceKind : null,
          duration: typeof x.duration === 'string' && x.duration.trim() ? x.duration : null,
          difficulty: x.difficulty === 'Easy' || x.difficulty === 'Moderate' || x.difficulty === 'Strenuous' ? x.difficulty : null,
          hidden: x.hidden === true,
        }
      : null,
  )

  // Added later: older files have none.
  const h = isObject(o.home) ? o.home : null
  const homeBase = h && synced(h)
  const home: Home | null =
    h && homeBase && typeof h.lat === 'number' && typeof h.lng === 'number' && isLngLat([h.lng, h.lat])
      ? { ...homeBase, name: str(h.name, 'Home'), lat: h.lat, lng: h.lng }
      : null

  return { schemaVersion: 1, updatedAt: str(o.updatedAt, new Date(0).toISOString()), trips, places, people, groups, hikeEdits, home }
}
