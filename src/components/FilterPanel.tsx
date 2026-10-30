import { useMemo } from 'react'
import { liveGroups, livePeople } from '../lib/derive.ts'
import { activeFilterCount, filterOptions, NO_FILTER, type TripFilter } from '../lib/filters.ts'
import type { TravelData } from '../lib/types.ts'
import { Avatar } from './Avatar.tsx'
import { GroupIcon } from './PeoplePicker.tsx'
import { MODE_FILTERS } from '../lib/legs.ts'

/**
 * The filters shared by the map and the lists, opening in place under the trip list's search (not
 * a panel of its own). Changes apply as you tap; "Show N trips" folds it away.
 */
export function FilterPanel({
  onClose,
  data,
  filter,
  onChange,
  resultCount,
}: {
  onClose: () => void
  data: TravelData
  filter: TripFilter
  onChange: (f: TripFilter) => void
  resultCount: number
}) {
  const people = useMemo(() => livePeople(data), [data])
  const groups = useMemo(() => liveGroups(data), [data])
  const { years, tags } = useMemo(() => filterOptions(data), [data])
  const set = (patch: Partial<TripFilter>) => onChange({ ...filter, ...patch })
  const chip = (on: boolean) => `min-h-9 rounded-full border px-3 text-sm ${on ? 'border-primary bg-primary text-on-primary font-bold' : 'border-line hover:bg-raised'}`

  return (
    <section aria-label="Filter trips" className="-mx-3 border-b border-line bg-bg/60 px-3 py-3">
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">With</legend>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const on = filter.groupIds.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ groupIds: on ? filter.groupIds.filter((x) => x !== g.id) : [...filter.groupIds, g.id] })}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${on ? 'border-primary bg-primary font-bold text-on-primary' : 'border-line hover:bg-raised'}`}
                >
                  <GroupIcon />
                  {g.name}
                </button>
              )
            })}
          </div>
        </fieldset>

        {people.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">People</legend>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const on = filter.personIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ personIds: on ? filter.personIds.filter((x) => x !== p.id) : [...filter.personIds, p.id] })}
                    className={`flex min-h-9 items-center gap-1.5 rounded-full border py-0.5 pr-3 pl-0.5 text-sm ${on ? 'border-primary bg-primary/10 font-bold' : 'border-line hover:bg-raised'}`}
                  >
                    <Avatar person={p} size={28} />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-bold">How you traveled</legend>
          <div className="flex flex-wrap gap-1.5">
            {MODE_FILTERS.map((m) => (
              <button key={m.id} type="button" title={m.hint} aria-pressed={filter.mode === m.id} onClick={() => set({ mode: filter.mode === m.id ? null : m.id })} className={chip(filter.mode === m.id)}>
                <span aria-hidden>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        {years.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Year</legend>
            <div className="flex flex-wrap gap-1.5">
              {years.map((y) => (
                <button key={y} type="button" aria-pressed={filter.year === y} onClick={() => set({ year: filter.year === y ? null : y })} className={chip(filter.year === y)}>
                  {y}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {tags.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Tag</legend>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button key={t} type="button" aria-pressed={filter.tag === t} onClick={() => set({ tag: filter.tag === t ? null : t })} className={chip(filter.tag === t)}>
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={activeFilterCount(filter) === 0}
            onClick={() => onChange(NO_FILTER)}
            className="min-h-10 rounded-lg px-3 text-sm font-bold text-muted hover:text-fg disabled:opacity-40"
          >
            Clear all
          </button>
          <button type="button" onClick={onClose} className="ml-auto min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary">
            Show {resultCount} {resultCount === 1 ? 'trip' : 'trips'}
          </button>
        </div>
      </div>
    </section>
  )
}

/** A button that opens the filters and shows how many are on. */
export function FilterButton({ filter, onClick, compact = false, expanded }: { filter: TripFilter; onClick: () => void; compact?: boolean; expanded?: boolean }) {
  const n = activeFilterCount(filter)
  return (
    <button
      onClick={onClick}
      aria-label={n ? `Filter, ${n} on` : 'Filter'}
      aria-expanded={expanded}
      className={`flex items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${compact ? 'h-9' : 'min-h-10 shadow-sm'} ${n ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-fg hover:bg-raised'}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      Filter{n > 0 && <span className="rounded-full bg-on-primary/20 px-1.5 text-xs">{n}</span>}
    </button>
  )
}
