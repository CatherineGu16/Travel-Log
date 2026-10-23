import { TRAVEL_MODES } from '../lib/travelModes.ts'
import type { TravelMode } from '../lib/types.ts'

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

