import type { TravelData, Trip } from '../lib/types.ts'
import { AvatarStack } from './Avatar.tsx'

/** Who went on a trip: the faces of the people on it. */
export function WhoWent({ trip, data, size = 26, max = 4 }: { trip: Trip; data: TravelData; size?: number; max?: number }) {
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)
  if (!people.length) return null
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <AvatarStack people={people} size={size} max={max} />
    </span>
  )
}
