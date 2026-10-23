import { setMapDetail, useMapDetail, type MapDetail } from '../ui/mapDetail.ts'

const OPTIONS: { id: MapDetail; label: string; hint: string }[] = [
  { id: 'outline', label: 'Outline', hint: 'States, parks, lakes and city labels, all built into the app. Works offline and contacts nobody.' },
  {
    id: 'detailed',
    label: 'Detailed',
    hint: 'Adds streets, terrain and labels from OpenFreeMap, and landmark and address search from Photon. They see the map area you view and what you search for, never your trips or access key.',
  },
]

export function MapDetailPanel() {
  const detail = useMapDetail()
  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="font-display text-xl font-semibold">Map detail</h2>
      <div role="radiogroup" aria-label="Map detail" className="mt-3 flex w-fit rounded-lg bg-bg p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={detail === o.id}
            onClick={() => setMapDetail(o.id)}
            className={`min-h-10 rounded-md px-3 text-sm ${detail === o.id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{OPTIONS.find((o) => o.id === detail)!.hint}</p>
    </section>
  )
}
