import { useId, useMemo, useState } from 'react'
import { liveGroups, livePeople } from '../lib/derive.ts'
import { FAMILY_GROUP_ID, type TravelData } from '../lib/types.ts'
import { Avatar } from './Avatar.tsx'

/**
 * "Who went": a group adds as a tag plus its members ("+ Family" tags Family and adds each family
 * member, so you can drop anyone who didn't come); a group with no members, like Friends, is just
 * the tag. Search adds individual people you've added before, or someone new.
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
  groupIds: string[]
  onGroupsChange: (ids: string[]) => void
  /** Creates a person and returns their id. */
  onAddPerson: (name: string, inFamily: boolean) => string | null
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [newInFamily, setNewInFamily] = useState(false)
  const people = useMemo(() => livePeople(data), [data])
  const groups = useMemo(() => liveGroups(data), [data])
  const tagged = groups.filter((g) => groupIds.includes(g.id))
  const chosen = value.map((pid) => data.people.find((p) => p.id === pid)).filter((p) => p !== undefined)

  const q = query.trim().toLowerCase()
  const matches = q ? people.filter((p) => !value.includes(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6) : []
  const exact = people.some((p) => p.name.toLowerCase() === q)

  const add = (ids: string[]) => onChange([...new Set([...value, ...ids])])
  // onChange and onGroupsChange are separate setters, so a group tap can update both at once.
  const addNew = () => {
    const created = onAddPerson(query.trim(), newInFamily)
    if (created) add([created])
    setQuery('')
    setNewInFamily(false)
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">Who went</legend>

      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Add a group">
        {groups
          .filter((g) => !groupIds.includes(g.id))
          .map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onGroupsChange([...groupIds, g.id])
                add(g.memberIds.filter((m) => people.some((p) => p.id === m)))
              }}
              className={`min-h-9 rounded-full border px-3 text-sm font-bold ${g.id === FAMILY_GROUP_ID ? 'border-park text-park' : 'border-line text-fg'} hover:bg-raised`}
            >
              + {g.name}
            </button>
          ))}
      </div>

      {(tagged.length > 0 || chosen.length > 0) && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Who went">
          {tagged.map((g) => (
            <li key={g.id} className={`flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 ${g.id === FAMILY_GROUP_ID ? 'bg-park/15 text-park' : 'bg-raised'}`}>
              <GroupIcon />
              <span className="text-sm font-bold">{g.name}</span>
              <button
                type="button"
                aria-label={`Remove ${g.name}`}
                onClick={() => {
                  onGroupsChange(groupIds.filter((x) => x !== g.id))
                  // Members came with the tag, so they go with it (unless another tagged group has them).
                  const keep = new Set(tagged.filter((t) => t.id !== g.id).flatMap((t) => t.memberIds))
                  onChange(value.filter((v) => !g.memberIds.includes(v) || keep.has(v)))
                }}
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-line hover:text-fg"
              >
                <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-raised py-1 pr-1 pl-1">
              <Avatar person={p} size={26} />
              <span className="text-sm">{p.deleted ? 'Someone removed' : p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => onChange(value.filter((v) => v !== p.id))}
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
        id={id}
        type="search"
        aria-label="Add a person"
        autoComplete="off"
        placeholder="Add a person (optional)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (matches[0]) {
            add([matches[0].id])
            setQuery('')
          } else if (q && !exact) addNew()
        }}
        className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base"
      />
      {(matches.length > 0 || (q && !exact)) && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-md">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  add([p.id])
                  setQuery('')
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left hover:bg-raised"
              >
                <Avatar person={p} size={26} />
                {p.name}
              </button>
            </li>
          ))}
          {q && !exact && (
            <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2 first:border-t-0">
              <button type="button" onClick={addNew} className="min-h-9 font-bold text-primary">
                Add “{query.trim()}”
              </button>
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={newInFamily} onChange={(e) => setNewInFamily(e.target.checked)} className="size-4 accent-[var(--park)]" />
                Family
              </label>
            </li>
          )}
        </ul>
      )}
    </fieldset>
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
