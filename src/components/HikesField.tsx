import { sameHikeName } from '../lib/addedHikes.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { hikeKey } from '../lib/travelActions.ts'
import type { TravelData, TripHike } from '../lib/types.ts'
import { HikeAdder } from './HikeAdder.tsx'
import { useNpsHikes } from '../ui/useNpsHikes.ts'
import { HikeFacts } from './HikeFacts.tsx'

/**
 * "Hikes" in the trip form, shown when the trip includes a national park: the hikes you did in
 * each park on this trip, added by name with suggestions from your past hikes and the NPS list.
 */
export function HikesField({
  parkIds,
  data,
  value,
  onChange,
}: {
  parkIds: string[]
  data: TravelData
  value: TripHike[]
  onChange: (hikes: TripHike[]) => void
}) {
  if (parkIds.length === 0) return null
  return (
    <section aria-label="Hikes" className="flex flex-col gap-4">
      {parkIds.map((parkId) => (
        <ParkHikes key={parkId} parkId={parkId} data={data} value={value} onChange={onChange} />
      ))}
    </section>
  )
}

function ParkHikes({ parkId, data, value, onChange }: { parkId: string; data: TravelData; value: TripHike[]; onChange: (hikes: TripHike[]) => void }) {
  const park = PARKS.find((p) => p.id === parkId)
  const nps = useNpsHikes(parkId, data)
  const keyOf = (h: TripHike) => hikeKey(h.parkId, h.hikeId, h.name)
  const here = value.filter((h) => h.parkId === parkId)
  const has = (hikeId: string | null, name: string) => here.some((h) => (hikeId !== null && h.hikeId === hikeId) || sameHikeName(h.name, name))
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-bold">Hikes in {park?.name ?? parkId}</h3>
      {here.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-lg border border-line">
          {here.map((h) => {
            const facts = nps.find((n) => n.id === h.hikeId)
            return (
              <li key={keyOf(h)} className="flex min-h-11 items-center gap-2 py-1 pr-1 pl-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{h.name}</span>
                  {facts && <HikeFacts hike={facts} />}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => onChange(value.filter((x) => keyOf(x) !== keyOf(h)))}
                  className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
                >
                  <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <HikeAdder parkId={parkId} data={data} has={has} onAdd={(h) => onChange([...value, h])} label={`Add a hike in ${park?.name ?? parkId}`} />
    </div>
  )
}
