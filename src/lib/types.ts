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

/**
 * One place on a trip, in visit order. Any number can be main destinations (each gets a pin);
 * the rest are stops along the way. Dates are this destination's own, when you know them.
 */
export interface Destination {
  placeId: string
  isMain: boolean
  startDate: PartialDate | null
  endDate: PartialDate | null
  note: string
  /**
   * Bends in the route from the previous destination to this one, [lng, lat] in order: points you
   * tapped so the dotted line follows the way you went. Not places, so no pins.
   */
  via: LngLat[]
}

export type LngLat = [number, number]

export interface TripHike {
  parkId: string
  /** From park-hikes.json, or null for a hike you typed in. */
  hikeId: string | null
  name: string
  date: PartialDate | null
}

export type TravelMode = 'road-trip' | 'flight' | 'cruise'

export interface Trip extends Synced {
  title: string
  startDate: PartialDate
  endDate: PartialDate | null
  approximate: boolean
  /** Where the trip went, in visit order; at least one is a main destination. */
  destinations: Destination[]
  /** People who went, one by one. */
  companions: string[]
  /** Groups that went, as a tag ("Friends"), without listing each person. */
  companionGroupIds: string[]
  hikes: TripHike[]
  /** How you traveled: road trip, flight or cruise. */
  travelMode: TravelMode | null
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
  /** Your corrections to the NPS hike suggestions (shared to the public list by its owner). */
  hikeEdits: HikeEdit[]
}

export type HikeDifficulty = 'Easy' | 'Moderate' | 'Strenuous'

/**
 * A correction to one suggested NPS hike: the values to show instead (all of them, not a diff), or
 * hidden to stop suggesting it. id = "parkId|hikeId". Deleting it goes back to NPS's values.
 */
export interface HikeEdit extends Synced {
  parkId: string
  hikeId: string
  name: string
  distanceMi: number | null
  distanceKind: DistanceKind | null
  duration: string | null
  difficulty: HikeDifficulty | null
  hidden: boolean
}

export type DistanceKind = 'round trip' | 'one way' | 'loop'

export interface EditContext {
  now: string
  newId: () => string
}

/** Fixed ids, so each device's default Family and Friends groups are the same records and merge into one. */
export const FAMILY_GROUP_ID = 'family'
export const FRIENDS_GROUP_ID = 'friends'
