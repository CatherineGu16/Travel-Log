/** "YYYY" | "YYYY-MM" | "YYYY-MM-DD" — dates can be as precise as you remember them. */
export type PartialDate = string

/** Every synced record carries these, so two devices can merge record by record. */
export interface Synced {
  id: string
  createdAt: string
  updatedAt: string
  /** Tombstone: kept so a delete on one device wins over an older copy on another. */
  deleted?: boolean
}

/** A location you've been to. Shared between trips, so repeat visits stack on one place. */
export interface Place extends Synced {
  name: string
  lat: number
  lng: number
  city: string | null
  /** ISO 3166-1, "US" in phase 1. */
  countryCode: string
  /** ISO 3166-2, e.g. "US-CA". Null when the point isn't in any state (e.g. at sea). */
  regionCode: string | null
  /** A national park from national-parks.json. */
  parkId: string | null
}

export interface Stop {
  placeId: string
  startDate: PartialDate | null
  endDate: PartialDate | null
  note: string
}

export interface TripHike {
  parkId: string
  /** From park-hikes.json, or null for a hike you typed in. */
  hikeId: string | null
  name: string
  date: PartialDate | null
}

export interface Trip extends Synced {
  title: string
  startDate: PartialDate
  endDate: PartialDate | null
  approximate: boolean
  /** Where the trip's pin goes. */
  mainPlaceId: string
  /** Key destinations, in visit order. */
  stops: Stop[]
  companions: string[]
  hikes: TripHike[]
  isFamily: boolean
  description: string
  highlights: string
  rating: number | null
  tags: string[]
}

export interface Avatar {
  kind: 'initials' | 'emoji' | 'photo'
  color: string
  emoji: string | null
  /** Set when kind is "photo": the photo lives at avatars/{personId}.webp. */
  photoUpdatedAt: string | null
}

export interface Person extends Synced {
  name: string
  avatar: Avatar
}

export interface Group extends Synced {
  name: string
  memberIds: string[]
  /** Exactly one group, "Family" (id FAMILY_GROUP_ID), has this. */
  isFamily: boolean
}

export interface TravelData {
  schemaVersion: 1
  updatedAt: string
  trips: Trip[]
  places: Place[]
  people: Person[]
  groups: Group[]
}

export interface EditContext {
  now: string
  newId: () => string
}

/** A fixed id, so each device's default Family group is the same record and merges into one. */
export const FAMILY_GROUP_ID = 'family'
