import { live } from '../lib/travelActions.ts'
import { FAMILY_GROUP_ID, type TravelData, type Trip } from '../lib/types.ts'
import { AvatarStack } from './Avatar.tsx'
import { GroupIcon } from './PeoplePicker.tsx'

/** Who went on a trip: group tags ("Friends") and the faces of the people listed. */
export function WhoWent({ trip, data, size = 26, max = 4 }: { trip: Trip; data: TravelData; size?: number; max?: number }) {
  const groups = live(data.groups).filter((g) => trip.companionGroupIds.includes(g.id))
  const people = trip.companions.map((id) => data.people.find((p) => p.id === id)).filter((p) => p !== undefined)
  if (!groups.length && !people.length) return null
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {groups.map((g) => (
        <span
          key={g.id}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${g.id === FAMILY_GROUP_ID ? 'bg-park/15 text-park' : 'bg-raised text-fg'}`}
        >
          <GroupIcon className="size-3.5" />
          {g.name}
        </span>
      ))}
      <AvatarStack people={people} size={size} max={max} />
    </span>
  )
}
