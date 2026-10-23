import { isPartialDate } from './partialDate.ts'
import { emptyData } from './travelActions.ts'
import { FAMILY_GROUP_ID, type Avatar, type Group, type Person, type Place, type Synced, type TravelData, type Trip } from './types.ts'

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
  const canon = (d: TravelData) => stable([d.trips, d.places, d.people, d.groups].map((records) => [...records].sort((x, y) => x.id.localeCompare(y.id))))
  return canon(a) === canon(b)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
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

  const trips = records<Trip>('trips', (x, base) => {
    const startDate = dateOrNull(x.startDate)
    if (!startDate || typeof x.mainPlaceId !== 'string') return null
    return {
      ...base,
      title: str(x.title, 'Trip'),
      startDate,
      endDate: dateOrNull(x.endDate),
      approximate: x.approximate === true,
      mainPlaceId: x.mainPlaceId,
      stops: (Array.isArray(x.stops) ? x.stops : [])
        .filter((s): s is Record<string, unknown> => isObject(s) && typeof s.placeId === 'string')
        .map((s) => ({ placeId: s.placeId as string, startDate: dateOrNull(s.startDate), endDate: dateOrNull(s.endDate), note: str(s.note) })),
      companions: strings(x.companions),
      hikes: (Array.isArray(x.hikes) ? x.hikes : [])
        .filter((h): h is Record<string, unknown> => isObject(h) && typeof h.parkId === 'string' && typeof h.name === 'string')
        .map((h) => ({ parkId: h.parkId as string, hikeId: typeof h.hikeId === 'string' ? h.hikeId : null, name: h.name as string, date: dateOrNull(h.date) })),
      isFamily: x.isFamily === true,
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
  // Every copy has the Family group, even an old or hand-made file.
  if (!groups.some((g) => g.id === FAMILY_GROUP_ID)) groups.push(emptyData(str(o.updatedAt, new Date(0).toISOString())).groups[0])

  return { schemaVersion: 1, updatedAt: str(o.updatedAt, new Date(0).toISOString()), trips, places, people, groups }
}
