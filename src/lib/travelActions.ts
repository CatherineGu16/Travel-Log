import { distanceMeters } from './geo.ts'
import {
  FAMILY_GROUP_ID,
  FRIENDS_GROUP_ID,
  type Avatar,
  type EditContext,
  type Group,
  type HikeEdit,
  type LngLat,
  type PartialDate,
  type Person,
  type Place,
  type Destination,
  type Home,
  type Profile,
  type TripStart,
  type LegMode,
  type Synced,
  type TravelData,
  type Trip,
  type TripHike,
} from './types.ts'

/** Edits are pure: (data, context) → new data. The store applies, saves, and can undo them. */

const EPOCH = new Date(0).toISOString()

/** Family and Friends, there from the start (Friends works as a tag without adding anyone). */
export const builtInGroups = (): Group[] => [
  { id: FAMILY_GROUP_ID, name: 'Family', memberIds: [], isFamily: true, createdAt: EPOCH, updatedAt: EPOCH },
  { id: FRIENDS_GROUP_ID, name: 'Friends', memberIds: [], isFamily: false, createdAt: EPOCH, updatedAt: EPOCH },
]

/**
 * The built-in groups are stamped at the epoch, so a new device's empty copy never wins a sync
 * merge over a Family group you've actually edited on another device.
 */

export function emptyData(now: string): TravelData {
  return {
    schemaVersion: 1,
    updatedAt: now,
    trips: [],
    places: [],
    people: [],
    groups: builtInGroups(),
    hikeEdits: [],
    home: null,
    profile: null,
  }
}

export const live = <T extends Synced>(records: T[]): T[] => records.filter((r) => !r.deleted)

// ---------- Places ----------

/** A place picked from search, from the map, or typed in, before it's saved. */
export interface PlaceInput {
  name: string
  lat: number
  lng: number
  city?: string | null
  countryCode?: string
  regionCode?: string | null
  parkId?: string | null
}

/** Either an existing place, or a new one to create (or reuse, if it's somewhere you've been). */
export type PlaceRef = { placeId: string } | { place: PlaceInput }

/**
 * Finds a saved place that is the same as this one: the same national park, the same name close by,
 * or practically the same spot. This is what makes repeat visits stack on one pin.
 */
export function findSamePlace(places: Place[], input: PlaceInput): Place | undefined {
  const candidates = live(places)
  if (input.parkId) {
    const park = candidates.find((p) => p.parkId === input.parkId)
    if (park) return park
  }
  const name = input.name.trim().toLowerCase()
  return (
    candidates.find((p) => p.name.trim().toLowerCase() === name && distanceMeters(p, input) < 5000) ??
    candidates.find((p) => distanceMeters(p, input) < 100)
  )
}

function resolvePlace(data: TravelData, ctx: EditContext, ref: PlaceRef): [TravelData, string] {
  if ('placeId' in ref) return [data, ref.placeId]
  const same = findSamePlace(data.places, ref.place)
  if (same) return [data, same.id]
  const place: Place = {
    id: ctx.newId(),
    name: ref.place.name.trim(),
    lat: ref.place.lat,
    lng: ref.place.lng,
    city: ref.place.city ?? null,
    countryCode: ref.place.countryCode ?? 'US',
    regionCode: ref.place.regionCode ?? null,
    parkId: ref.place.parkId ?? null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
  return [{ ...data, places: [...data.places, place] }, place.id]
}

// ---------- Trips ----------

export interface DestinationInput {
  place: PlaceRef
  isMain: boolean
  startDate: PartialDate | null
  endDate: PartialDate | null
  note: string
  /** Bends in the route from the previous destination (see Destination.via). */
  via?: LngLat[]
  /** How you got here from the previous destination; null or omitted is guessed. */
  legMode?: LegMode | null
}

export interface TripInput {
  title: string
  startDate: PartialDate
  endDate: PartialDate | null
  approximate: boolean
  /** In visit order. If none is marked main, the first one is. */
  destinations: DestinationInput[]
  companions: string[]
  /** How you got from the start to the first place, and back at the end; flight when omitted. */
  startMode?: LegMode
  endMode?: LegMode
  /** Bends on the way there and back (see Trip.startVia); dropped for a flight. */
  startVia?: LngLat[]
  endVia?: LngLat[]
  /** Where the trip started and ended (see Trip.start). */
  start?: TripStart | null
  description: string
  highlights: string
  rating: number | null
  tags: string[]
  /** Hikes done on this trip. Left as-is when omitted on an update. */
  hikes?: TripHike[]
}

/** Creates a trip, or updates one when `tripId` is given. Places are created or reused as needed. */
export function saveTrip(data: TravelData, ctx: EditContext, input: TripInput, tripId?: string): TravelData {
  if (input.destinations.length === 0) throw new Error('Add where the trip went.')
  let next = data
  const destinations: Destination[] = []
  for (const d of input.destinations) {
    let placeId: string
    ;[next, placeId] = resolvePlace(next, ctx, d.place)
    // The same place twice in a row (e.g. picked again) is one destination.
    if (destinations.at(-1)?.placeId === placeId) continue
    destinations.push({
      placeId,
      isMain: d.isMain,
      startDate: d.startDate,
      endDate: d.endDate && d.endDate !== d.startDate ? d.endDate : null,
      note: d.note.trim(),
      // A destination that's now first has no route leading to it.
      via: destinations.length ? (d.via ?? []) : [],
      legMode: destinations.length ? (d.legMode ?? null) : null,
    })
  }
  if (!destinations.some((d) => d.isMain)) destinations[0].isMain = true
  const fields = {
    title: input.title.trim(),
    startDate: input.startDate,
    endDate: input.endDate && input.endDate !== input.startDate ? input.endDate : null,
    approximate: input.approximate,
    destinations,
    companions: [...new Set(input.companions)],
    startMode: input.startMode ?? 'flight',
    endMode: input.endMode ?? 'flight',
    startVia: (input.startMode ?? 'flight') === 'flight' ? [] : (input.startVia ?? []),
    endVia: (input.endMode ?? 'flight') === 'flight' ? [] : (input.endVia ?? []),
    start: input.start ? { name: input.start.name, lat: input.start.lat, lng: input.start.lng } : null,
    description: input.description.trim(),
    highlights: input.highlights.trim(),
    rating: input.rating,
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
    ...(input.hikes ? { hikes: cleanHikes(input.hikes) } : {}),
  }
  if (tripId) {
    const existing = next.trips.find((t) => t.id === tripId && !t.deleted)
    if (!existing) throw new Error('That trip no longer exists.')
    return {
      ...next,
      updatedAt: ctx.now,
      trips: next.trips.map((t) => (t.id === tripId ? { ...t, ...fields, updatedAt: ctx.now } : t)),
    }
  }
  const trip: Trip = { id: ctx.newId(), hikes: [], ...fields, createdAt: ctx.now, updatedAt: ctx.now }
  return { ...next, updatedAt: ctx.now, trips: [...next.trips, trip] }
}

// ---------- Hikes ----------

/** One entry per hike per trip; custom hikes need a name. */
function cleanHikes(hikes: TripHike[]): TripHike[] {
  const seen = new Set<string>()
  const out: TripHike[] = []
  for (const h of hikes) {
    const name = h.name.trim()
    if (!name) continue
    const key = hikeKey(h.parkId, h.hikeId, name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ parkId: h.parkId, hikeId: h.hikeId, name, date: h.date })
  }
  return out
}

/** Identifies a hike within a park: its NPS id, or for a hike you typed in, its name. */
export const hikeKey = (parkId: string, hikeId: string | null, name: string) =>
  `${parkId}|${hikeId ?? `custom:${name.trim().toLowerCase()}`}`

/** Checks off a hike on a trip (or updates its date). */
export function addHike(data: TravelData, ctx: EditContext, tripId: string, hike: TripHike): TravelData {
  const trips = data.trips.map((t) =>
    t.id === tripId
      ? {
          ...t,
          hikes: cleanHikes([...t.hikes.filter((h) => hikeKey(h.parkId, h.hikeId, h.name) !== hikeKey(hike.parkId, hike.hikeId, hike.name)), hike]),
          updatedAt: ctx.now,
        }
      : t,
  )
  return { ...data, updatedAt: ctx.now, trips }
}

export function removeHike(data: TravelData, ctx: EditContext, tripId: string, key: string): TravelData {
  const trips = data.trips.map((t) =>
    t.id === tripId ? { ...t, hikes: t.hikes.filter((h) => hikeKey(h.parkId, h.hikeId, h.name) !== key), updatedAt: ctx.now } : t,
  )
  return { ...data, updatedAt: ctx.now, trips }
}

export function deleteTrip(data: TravelData, ctx: EditContext, tripId: string): TravelData {
  return { ...data, updatedAt: ctx.now, trips: tombstone(data.trips, tripId, ctx.now) }
}

// ---------- People ----------

export const AVATAR_COLORS = ['#d1543a', '#2b6f8f', '#2f7d4f', '#8a5cc2', '#c98a1a', '#c2477a', '#3f7f86', '#6b6f2a']

export function defaultAvatar(name: string): Avatar {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { kind: 'initials', color: AVATAR_COLORS[hash % AVATAR_COLORS.length], emoji: null, photoUpdatedAt: null }
}

export interface PersonInput {
  name: string
  avatar?: Avatar
  groupIds: string[]
}

/** Adds a person with a chosen id (so a form can refer to them right away) and puts them in groups. */
export function addPerson(data: TravelData, ctx: EditContext, id: string, input: PersonInput): TravelData {
  const name = input.name.trim()
  if (!name) throw new Error('A person needs a name.')
  const person: Person = { id, name, avatar: input.avatar ?? defaultAvatar(name), createdAt: ctx.now, updatedAt: ctx.now }
  return setPersonGroups({ ...data, updatedAt: ctx.now, people: [...data.people, person] }, ctx, id, input.groupIds)
}

export function updatePerson(data: TravelData, ctx: EditContext, id: string, input: PersonInput): TravelData {
  const name = input.name.trim()
  if (!name) throw new Error('A person needs a name.')
  const people = data.people.map((p) =>
    p.id === id ? { ...p, name, avatar: input.avatar ?? p.avatar, updatedAt: ctx.now } : p,
  )
  return setPersonGroups({ ...data, updatedAt: ctx.now, people }, ctx, id, input.groupIds)
}

/** Removes a person from people and groups. Past trips keep them as "Someone removed". */
export function deletePerson(data: TravelData, ctx: EditContext, id: string): TravelData {
  const next = setPersonGroups(data, ctx, id, [])
  return { ...next, updatedAt: ctx.now, people: tombstone(next.people, id, ctx.now) }
}

/** Makes the person a member of exactly these groups. */
export function setPersonGroups(data: TravelData, ctx: EditContext, personId: string, groupIds: string[]): TravelData {
  const wanted = new Set(groupIds)
  const groups = data.groups.map((g) => {
    const has = g.memberIds.includes(personId)
    const want = wanted.has(g.id) && !g.deleted
    if (has === want) return g
    const memberIds = want ? [...g.memberIds, personId] : g.memberIds.filter((m) => m !== personId)
    return { ...g, memberIds, updatedAt: ctx.now }
  })
  return { ...data, updatedAt: ctx.now, groups }
}

// ---------- Groups ----------

export function addGroup(data: TravelData, ctx: EditContext, name: string, memberIds: string[] = []): TravelData {
  const clean = name.trim()
  if (!clean) throw new Error('A group needs a name.')
  const group: Group = { id: ctx.newId(), name: clean, memberIds: [...new Set(memberIds)], isFamily: false, createdAt: ctx.now, updatedAt: ctx.now }
  return { ...data, updatedAt: ctx.now, groups: [...data.groups, group] }
}

export function updateGroup(data: TravelData, ctx: EditContext, id: string, patch: { name?: string; memberIds?: string[] }): TravelData {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('A group needs a name.')
  const groups = data.groups.map((g) =>
    g.id === id
      ? {
          ...g,
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.memberIds ? { memberIds: [...new Set(patch.memberIds)] } : {}),
          updatedAt: ctx.now,
        }
      : g,
  )
  return { ...data, updatedAt: ctx.now, groups }
}

export function deleteGroup(data: TravelData, ctx: EditContext, id: string): TravelData {
  if (data.groups.find((g) => g.id === id)?.isFamily) throw new Error("The Family group can't be deleted.")
  return { ...data, updatedAt: ctx.now, groups: tombstone(data.groups, id, ctx.now) }
}

// ---------- Hike corrections ----------

export type HikeEditInput = Pick<HikeEdit, 'parkId' | 'hikeId' | 'name' | 'distanceMi' | 'distanceKind' | 'duration' | 'difficulty' | 'hidden'>

export const hikeEditId = (parkId: string, hikeId: string) => `${parkId}|${hikeId}`

/** Saves your correction to a suggested hike (replacing any earlier one). */
export function saveHikeEdit(data: TravelData, ctx: EditContext, input: HikeEditInput): TravelData {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('A hike needs a name.')
  const id = hikeEditId(input.parkId, input.hikeId)
  const existing = data.hikeEdits.find((e) => e.id === id)
  const record: HikeEdit = {
    ...input,
    id,
    name,
    distanceMi: input.distanceMi !== null && Number.isFinite(input.distanceMi) && input.distanceMi >= 0 ? Math.round(input.distanceMi * 10) / 10 : null,
    duration: input.duration?.trim() || null,
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  }
  return { ...data, updatedAt: ctx.now, hikeEdits: [...data.hikeEdits.filter((e) => e.id !== id), record] }
}

/** Drops your correction, so the hike shows NPS's values again. */
export function resetHikeEdit(data: TravelData, ctx: EditContext, parkId: string, hikeId: string): TravelData {
  return { ...data, updatedAt: ctx.now, hikeEdits: tombstone(data.hikeEdits, hikeEditId(parkId, hikeId), ctx.now) }
}

// ---------- Home ----------

export const HOME_RECORD_ID = 'home'

/**
 * Sets where new trips start and end, or clears it (a tombstone, so the clear syncs). Trips keep
 * their own start, so earlier trips don't move: trips saved before they kept one get the old home
 * copied onto them first. (With no home yet, those trips start at the first one you set.)
 */
export function setHome(data: TravelData, ctx: EditContext, home: { name: string; lat: number; lng: number } | null): TravelData {
  const old = data.home && !data.home.deleted ? { name: data.home.name, lat: data.home.lat, lng: data.home.lng } : null
  const trips = old ? data.trips.map((t) => (t.start === undefined && !t.deleted ? { ...t, start: old, updatedAt: ctx.now } : t)) : data.trips
  const createdAt = data.home?.createdAt ?? ctx.now
  const record: Home | null = home
    ? { id: HOME_RECORD_ID, name: home.name.trim() || 'Home', lat: home.lat, lng: home.lng, createdAt, updatedAt: ctx.now }
    : data.home && { ...data.home, deleted: true, updatedAt: ctx.now }
  return { ...data, updatedAt: ctx.now, trips, home: record }
}

/** Your name and avatar on the You page. */
export const PROFILE_RECORD_ID = 'profile'

/** Sets your name and avatar (an empty name is fine: the page then asks for one). */
export function setProfile(data: TravelData, ctx: EditContext, profile: { name: string; avatar: Avatar }): TravelData {
  const record: Profile = {
    id: PROFILE_RECORD_ID,
    name: profile.name.trim(),
    avatar: profile.avatar,
    createdAt: data.profile?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  }
  return { ...data, updatedAt: ctx.now, profile: record }
}

// ---------- Undo ----------

/**
 * Undo as a new edit: records that differ from the snapshot go back to it with a fresh updatedAt
 * (so the revert wins when devices merge), and records created since are tombstoned.
 */
export function revertTo(current: TravelData, snapshot: TravelData, ctx: EditContext): TravelData {
  return {
    ...snapshot,
    updatedAt: ctx.now,
    trips: revertRecords(current.trips, snapshot.trips, ctx.now),
    places: revertRecords(current.places, snapshot.places, ctx.now),
    people: revertRecords(current.people, snapshot.people, ctx.now),
    groups: revertRecords(current.groups, snapshot.groups, ctx.now),
    hikeEdits: revertRecords(current.hikeEdits, snapshot.hikeEdits, ctx.now),
    home: revertRecords(asList(current.home), asList(snapshot.home), ctx.now)[0] ?? null,
    profile: revertRecords(asList(current.profile), asList(snapshot.profile), ctx.now)[0] ?? null,
  }
}

/** The single home record as a list, so it merges and reverts like the other records. */
export const asList = <T,>(record: T | null): T[] => (record ? [record] : [])

function revertRecords<T extends Synced>(current: T[], snapshot: T[], now: string): T[] {
  const before = new Map(snapshot.map((x) => [x.id, x]))
  return current.map((x) => {
    const old = before.get(x.id)
    if (!old) return x.deleted ? x : { ...x, deleted: true, updatedAt: now }
    return JSON.stringify(old) === JSON.stringify(x) ? x : { ...old, updatedAt: now }
  })
}

function tombstone<T extends Synced>(records: T[], id: string, now: string): T[] {
  return records.map((r) => (r.id === id ? { ...r, deleted: true, updatedAt: now } : r))
}
