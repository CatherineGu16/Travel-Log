import { useMemo, useState } from 'react'
import { liveGroups, livePeople } from '../lib/derive.ts'
import { FAMILY_GROUP_ID, type Person, type TravelData } from '../lib/types.ts'
import { Avatar } from './Avatar.tsx'

/** Letters to change to turn one name into the other ("Alex" → "Alexa" is 1), for "Did you mean". */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

/**
 * "Who went": your groups as chips that are either on or off (on adds everyone in the group, off
 * takes them all off again), anyone else going as chips with ×, and a search to add someone else,
 * which can add someone new (after offering anyone with a similar name, so a typo doesn't make a
 * second Alex). A group that's on stands for its people, so they aren't listed one by one. People
 * not in a group are only found by searching. The trip only ever records the people.
 */
export function PeoplePicker({
  data,
  value,
  onChange,
  onAddPerson,
}: {
  data: TravelData
  value: string[]
  onChange: (ids: string[]) => void
  /** Creates a person in these groups and returns their id. */
  onAddPerson: (name: string, groupIds: string[]) => string | null
}) {
  const [query, setQuery] = useState('')
  const [newGroups, setNewGroups] = useState<string[]>([])
  const people = useMemo(() => livePeople(data), [data])
  const groups = useMemo(
    () =>
      liveGroups(data)
        .sort((a, b) => Number(b.id === FAMILY_GROUP_ID) - Number(a.id === FAMILY_GROUP_ID) || a.name.localeCompare(b.name))
        .map((g) => ({ group: g, members: g.memberIds.filter((id) => people.some((p) => p.id === id)) }))
        .filter((g) => g.members.length > 0),
    [data, people],
  )
  // A group is on when everyone in it is going; its people are then covered by the group chip.
  const groupOn = (members: string[]) => members.every((id) => value.includes(id))
  const covered = new Set(groups.filter((g) => groupOn(g.members)).flatMap((g) => g.members))
  const others = value.filter((id) => !covered.has(id)).map((id) => data.people.find((p) => p.id === id)).filter((p): p is Person => !!p)

  const q = query.trim().toLowerCase()
  const matches = q ? people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : []
  const exact = people.some((p) => p.name.toLowerCase() === q)
  // A near miss ("Alexa" for "Alex"), offered before adding someone new.
  const similar = q && !matches.length ? people.filter((p) => editDistance(p.name.toLowerCase(), q) <= Math.max(1, Math.floor(q.length / 4))).slice(0, 3) : []

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  const addNew = () => {
    const created = onAddPerson(query.trim(), newGroups)
    if (created) onChange([...value, created])
    setQuery('')
    setNewGroups([])
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-1.5 flex w-full items-baseline gap-2 text-sm font-bold">
        Who went
        {value.length > 0 && <span className="font-normal text-muted">{value.length === 1 ? '1 person' : `${value.length} people`}</span>}
      </legend>

      {groups.length > 0 && (
        <div role="group" aria-label="Groups" className="flex flex-wrap items-center gap-1.5">
          {groups.map(({ group, members }) => {
            const on = groupOn(members)
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? value.filter((v) => !members.includes(v)) : [...new Set([...value, ...members])])}
                className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold ${
                  on ? 'border-primary bg-primary text-on-primary' : 'border-line text-fg hover:border-muted'
                }`}
              >
                <GroupIcon className="size-4" />
                {group.name}
              </button>
            )
          })}
        </div>
      )}

      {others.length > 0 && (
        <ul aria-label="Also going" className="flex flex-wrap gap-1.5">
          {others.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-0.5 pl-0.5 text-sm font-bold">
              <Avatar person={p} size={28} />
              <span className="pl-0.5">{p.deleted ? 'Someone removed' : p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => toggle(p.id)}
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
        placeholder={people.length ? 'Add someone else' : 'Add a person (optional)'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (matches[0]) {
            if (!value.includes(matches[0].id)) toggle(matches[0].id)
            setQuery('')
          } else if (q && !exact && !similar.length) addNew()
        }}
        className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base"
      />

      {q && (
        <div className="flex flex-col gap-2">
          {matches.length > 0 && (
            <div role="group" aria-label="Matching people" className="flex flex-wrap gap-1.5">
              {matches.map((p) => (
                <PersonChip key={p.id} person={p} on={value.includes(p.id)} onToggle={() => toggle(p.id)} />
              ))}
            </div>
          )}
          {similar.length > 0 && (
            <div role="group" aria-label="Did you mean" className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted">Did you mean</span>
              {similar.map((p) => (
                <PersonChip
                  key={p.id}
                  person={p}
                  on={value.includes(p.id)}
                  onToggle={() => {
                    toggle(p.id)
                    setQuery('')
                  }}
                />
              ))}
            </div>
          )}
          {!exact && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-line px-3 py-2">
              <button type="button" onClick={addNew} className="min-h-9 self-start font-bold text-primary">
                Add “{query.trim()}”{people.length ? ' as someone new' : ''}
              </button>
              {liveGroups(data).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-xs text-muted">In:</span>
                  {liveGroups(data).map((g) => {
                    const on = newGroups.includes(g.id)
                    return (
                      <label key={g.id} className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 ${on ? 'border-primary bg-primary/10 font-bold' : 'border-line text-muted'}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setNewGroups(e.target.checked ? [...newGroups, g.id] : newGroups.filter((x) => x !== g.id))}
                          className="size-3.5 accent-[var(--primary)]"
                        />
                        {g.name}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </fieldset>
  )
}

/** A person to tap on or off: a plus when they're not going, a check when they are. */
function PersonChip({ person, on, onToggle }: { person: Person; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`flex min-h-9 items-center gap-1.5 rounded-full border py-0.5 pr-3 pl-0.5 text-sm ${
        on ? 'border-primary bg-primary/10 font-bold text-fg' : 'border-line text-fg hover:border-muted'
      }`}
    >
      <Avatar person={person} size={28} />
      {person.deleted ? 'Someone removed' : person.name}
      <span aria-hidden className={on ? 'text-primary' : 'text-muted'}>
        {on ? '✓' : '+'}
      </span>
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
