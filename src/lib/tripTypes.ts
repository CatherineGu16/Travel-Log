import type { TripType } from './types.ts'

/** Who the trip was with: shown on the form, badges, filters and grouping. */
export const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
  { id: 'work', label: 'Work' },
]

export const tripTypeLabel = (type: TripType | null) => TRIP_TYPES.find((t) => t.id === type)?.label ?? null
