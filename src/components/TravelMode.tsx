import { TRAVEL_MODES } from '../lib/travelModes.ts'
import { tripTypeLabel } from '../lib/tripTypes.ts'
import type { TravelMode, TripType } from '../lib/types.ts'

/** A small "🚗 Road trip" badge for cards and lists. */
export function TravelModeBadge({ mode }: { mode: TravelMode | null }) {
  const m = TRAVEL_MODES.find((x) => x.id === mode)
  if (!m) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-xs font-bold text-fg">
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  )
}

const TYPE_TONE: Record<TripType, string> = {
  family: 'bg-park/15 text-park',
  friends: 'bg-[var(--route)]/15 text-[var(--route)]',
  work: 'bg-raised text-muted',
}

/** "Family", "Friends" or "Work" for cards and lists. */
export function TripTypeBadge({ type }: { type: TripType | null }) {
  if (!type) return null
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${TYPE_TONE[type]}`}>{tripTypeLabel(type)}</span>
}
