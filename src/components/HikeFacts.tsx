import type { NpsHike } from '../lib/gazetteer.ts'

const TONE = {
  Easy: 'bg-ok/15 text-ok',
  Moderate: 'bg-[#e0a526]/20 text-[#8a6410] dark:text-[#e0b85a]',
  Strenuous: 'bg-danger/15 text-danger',
} as const

/** "Moderate · 2.2 mi · 1–2 hours" for a hike, as far as it's known. */
export function HikeFacts({ hike }: { hike: Pick<NpsHike, 'difficulty' | 'distanceMi' | 'distanceSource' | 'duration'> }) {
  const rest = [
    hike.distanceMi !== null && `${hike.distanceSource === 'osm' ? '≈' : ''}${hike.distanceMi} mi`,
    hike.duration,
  ].filter(Boolean)
  if (!hike.difficulty && rest.length === 0) return null
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
      {hike.difficulty && <span className={`rounded-full px-1.5 py-px font-bold ${TONE[hike.difficulty]}`}>{hike.difficulty}</span>}
      {rest.length > 0 && (
        <span title={hike.distanceSource === 'osm' ? 'Distance is the length of the mapped trail (OpenStreetMap), so approximate.' : undefined}>
          {rest.join(' · ')}
        </span>
      )}
    </span>
  )
}
