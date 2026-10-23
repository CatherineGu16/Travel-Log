import type { PlaceRef } from './travelActions.ts'
import type { TravelData } from './types.ts'

/** What the form shows for a chosen place, before it's saved. */
export interface ChosenPlace {
  ref: PlaceRef
  label: string
  detail: string
  isPark: boolean
  parkId: string | null
}

/** Turns a saved place or a place input into what the form shows. */
export function describeRef(ref: PlaceRef, data: TravelData): ChosenPlace {
  if ('placeId' in ref) {
    const p = data.places.find((x) => x.id === ref.placeId)
    return { ref, label: p?.name ?? 'Unknown place', detail: p?.regionCode?.replace(/^US-/, '') ?? '', isPark: !!p?.parkId, parkId: p?.parkId ?? null }
  }
  return { ref, label: ref.place.name, detail: ref.place.regionCode?.replace(/^US-/, '') ?? '', isPark: !!ref.place.parkId, parkId: ref.place.parkId ?? null }
}
