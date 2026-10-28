import { useMemo, useState } from 'react'
import { liveGroups, livePeople } from '../lib/derive.ts'
import { FAMILY_GROUP_ID, type Person, type TravelData } from '../lib/types.ts'
import { Avatar } from './Avatar.tsx'

/**
 * "Who went": your people sorted under their groups (Family, Friends, your own, then everyone else),
 * each a button that's on when they went. Groups only sort people; they never add everyone in them.
 * Typing narrows the list or adds someone new, in whichever groups you pick. Trips tagged with a
 * whole group before keep the tag until you remove it.
 */
export function PeoplePicker({
  data,
  value,
  onChange,
  groupIds,
  onGroupsChange,
  onAddPerson,
}: {
  data: TravelData
  value: string[]
  onChange: (ids: string[]) => void
  /** Groups tagged on the trip as a whole (only from before; no longer added here). */
  groupIds: string[]
  onGroupsChange: (ids: string[]) => void
  /** Creates a person in these groups and returns their id. */
  onAddPerson: (name: string, groupIds: string[]) => string | null
}) {
  const [query, setQuery] = useState('')
  const [newGroups, setNewGroups] = useState<string[]>([])
  const people = useMemo(() => livePeople(data), [data])
  const groups = useMemo(() => liveGroups(data).sort((a, b) => Number(b.id === FAMILY_GROUP_ID) - Number(a.id === FAMILY_GROUP_ID) || a.name.localeCompare(b.name)), [data])
  const tagged = groups.filter((g) => groupIds.includes(g.id))

  const q = query.trim().toLowerCase()
  const matches = q ? people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : []
  const exact = people.some((p) => p.name.toLowerCase() === q)
  // Each group's people, then everyone in no group (and anyone on the trip who's since been removed).
  const sections = useMemo(() => {
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name)
    const grouped = new Set(groups.flatMap((g) => g.memberIds))
    const removed = value.map((id) => data.people.find((p) => p.id === id)).filter((p): p is Person => !!p?.deleted)
    return [
      ...groups.map((g) => ({ key: g.id, name: g.name, people: people.filter((p) => g.memberIds.includes(p.id)).sort(byName) })),
      { key: 'others', name: groups.length ? 'Others' : 'People', people: [...people.filter((p) => !grouped.has(p.id)).sort(byName), ...removed] },
    ].filter((s) => s.people.length > 0)
  }, [groups, people, value, data.people])

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  const addNew = () => {
    const created = onAddPerson(query.trim(), newGroups)
    if (created) onChange([...value, created])
    setQuery('')
    setNewGroups([])
  }
  const went = value.length

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex w-full items-baseline gap-2 text-sm font-bold">
        Who went
        {went > 0 && <span className="font-normal text-muted">{went === 1 ? '1 person' : `${went} people`}</span>}
      </legend>

      {tagged.length > 0 && (
        <ul className="mb-2 flex flex-wrap items-center gap-1.5 text-sm" aria-label="Tagged groups">
          <span className="text-xs text-muted">Tagged:</span>
          {tagged.map((g) => (
            <li key={g.id} className="flex items-center gap-1 rounded-full bg-raised py-0.5 pr-0.5 pl-3">
              <span className="font-bold">{g.name}</span>
              <button
                type="button"
                aria-label={`Remove the ${g.name} tag`}
                onClick={() => onGroupsChange(groupIds.filter((x) => x !== g.id))}
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-line hover:text-fg"
              >
                <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        aria-label="Add a person"
        autoComplete="off"
        placeholder={people.length ? 'Find or add a person' : 'Add a person (optional)'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (matches[0]) {
            if (!value.includes(matches[0].id)) toggle(matches[0].id)
            setQuery('')
          } else if (q && !exact) addNew()
        }}
        className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base"
      />

      {q ? (
        <div className="mt-2 flex flex-col gap-2">
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Matching people">
              {matches.map((p) => (
                <PersonToggle key={p.id} person={p} on={value.includes(p.id)} onToggle={() => toggle(p.id)} />
              ))}
            </div>
          )}
          {!exact && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line px-3 py-2">
              <button type="button" onClick={addNew} className="min-h-9 font-bold text-primary">
                Add “{query.trim()}”
              </button>
              {groups.map((g) => (
                <label key={g.id} className="flex min-h-9 items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={newGroups.includes(g.id)}
                    onChange={(e) => setNewGroups(e.target.checked ? [...newGroups, g.id] : newGroups.filter((x) => x !== g.id))}
                    className="size-4"
                  />
                  {g.name}
                </label>
              ))}
            </div>
          )}
        </div>
      ) : (
        sections.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {sections.map((s) => (
              <div key={s.key} role="group" aria-label={s.name}>
                <div className="mb-1 text-xs font-bold text-muted">{s.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {s.people.map((p) => (
                    <PersonToggle key={p.id} person={p} on={value.includes(p.id)} onToggle={() => toggle(p.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </fieldset>
  )
}

/** A person you can mark as on the trip or not: filled with a check when they went. */
function PersonToggle({ person, on, onToggle }: { person: Person; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`flex min-h-9 items-center gap-1.5 rounded-full border py-0.5 pr-3 pl-0.5 text-sm ${
        on ? 'border-primary bg-primary/10 font-bold text-fg' : 'border-line text-muted hover:border-muted hover:text-fg'
      }`}
    >
      <Avatar person={person} size={28} />
      {person.deleted ? 'Someone removed' : person.name}
      {on && (
        <svg viewBox="0 0 20 20" className="size-4 text-primary" aria-hidden>
          <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

export function GroupIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden>
      <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 19c.6-3.3 3.1-5 6-5s5.4 1.7 6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M17 14c2.2 0 3.6 1.4 4 3.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
