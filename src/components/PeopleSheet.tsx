import { useState } from 'react'
import { liveGroups, livePeople } from '../lib/derive.ts'
import {
  addGroup,
  addPerson,
  AVATAR_COLORS,
  defaultAvatar,
  deleteGroup,
  deletePerson,
  live,
  updateGroup,
  updatePerson,
} from '../lib/travelActions.ts'
import type { Avatar as AvatarData, Group, Person } from '../lib/types.ts'
import { newId, useStore, useTravelState } from '../store/useTravel.ts'
import { Avatar } from './Avatar.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './toastContext.ts'

type View = { kind: 'list' } | { kind: 'person'; id: string | null } | { kind: 'group'; id: string | null }

const EMOJIS = ['😀', '😎', '🥾', '🏔️', '🌲', '🏕️', '🚗', '✈️', '🐶', '🐱', '🌊', '☀️', '🌵', '🦋', '🎒', '❤️']

/** People & groups: everyone you travel with, their avatars, and the groups used as shortcuts. */
export function PeopleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const close = () => {
    setView({ kind: 'list' })
    onClose()
  }
  const back = () => setView({ kind: 'list' })

  const title = view.kind === 'person' ? (view.id ? 'Edit person' : 'Add person') : view.kind === 'group' ? (view.id ? 'Edit group' : 'New group') : 'People & groups'
  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title={title}>
      {view.kind === 'list' && <PeopleList onPerson={(id) => setView({ kind: 'person', id })} onGroup={(id) => setView({ kind: 'group', id })} />}
      {view.kind === 'person' && <PersonEditor id={view.id} onDone={back} />}
      {view.kind === 'group' && <GroupEditor id={view.id} onDone={back} />}
    </Sheet>
  )
}

function PeopleList({ onPerson, onGroup }: { onPerson: (id: string | null) => void; onGroup: (id: string | null) => void }) {
  const { data } = useTravelState()
  const people = livePeople(data)
  const groups = liveGroups(data)
  const tripCount = (id: string) => live(data.trips).filter((t) => t.companions.includes(id)).length

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-2 flex items-center">
          <h3 className="font-display text-xl font-semibold">People</h3>
          <button onClick={() => onPerson(null)} className="ml-auto min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
            + Add person
          </button>
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-muted">No one yet. Add people here, or while adding a trip.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {people.map((p) => (
              <li key={p.id}>
                <button onClick={() => onPerson(p.id)} className="flex w-full flex-col items-center gap-1 rounded-xl p-2 hover:bg-raised">
                  <Avatar person={p} size={52} />
                  <span className="w-full truncate text-center text-sm font-bold">{p.name}</span>
                  <span className="text-xs text-muted">{tripCount(p.id)} trips</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <div className="mb-2 flex items-center">
          <h3 className="font-display text-xl font-semibold">Groups</h3>
          <button onClick={() => onGroup(null)} className="ml-auto min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-raised">
            + New group
          </button>
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {groups.map((g) => {
            const members = g.memberIds.map((id) => people.find((p) => p.id === id)).filter((p) => p !== undefined)
            return (
              <li key={g.id}>
                <button onClick={() => onGroup(g.id)} className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-raised">
                  <span className="min-w-0 flex-1">
                    <span className={`block font-bold ${g.isFamily ? 'text-park' : ''}`}>{g.name}</span>
                    <span className="block truncate text-xs text-muted">{members.length ? members.map((m) => m.name).join(', ') : 'No one yet'}</span>
                  </span>
                  <span className="flex">
                    {members.slice(0, 4).map((m, i) => (
                      <span key={m.id} style={{ marginLeft: i ? -8 : 0 }}>
                        <Avatar person={m} size={26} ring />
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function PersonEditor({ id, onDone }: { id: string | null; onDone: () => void }) {
  const store = useStore()
  const toast = useToast()
  const { data } = useTravelState()
  const existing: Person | undefined = id ? data.people.find((p) => p.id === id) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [avatar, setAvatar] = useState<AvatarData>(existing?.avatar ?? defaultAvatar(''))
  const [groupIds, setGroupIds] = useState<string[]>(() => (id ? data.groups.filter((g) => g.memberIds.includes(id)).map((g) => g.id) : []))
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!name.trim()) return setError('Add a name.')
    const input = { name, avatar, groupIds }
    const ok = id
      ? store.apply((d, c) => updatePerson(d, c, id, input), `Edited ${name.trim()}`)
      : store.apply((d, c) => addPerson(d, c, newId(), input), `Added ${name.trim()}`)
    if (ok === null) return setError(store.getState().error)
    onDone()
  }

  const remove = () => {
    if (!id || !existing) return
    const undoId = store.apply((d, c) => deletePerson(d, c, id), `Removed ${existing.name}`)
    if (undoId !== null) toast(`Removed ${existing.name}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onDone()
  }

  const kindBtn = (kind: AvatarData['kind'], label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={avatar.kind === kind}
      onClick={() => setAvatar({ ...avatar, kind, emoji: kind === 'emoji' ? (avatar.emoji ?? EMOJIS[0]) : avatar.emoji })}
      className={`min-h-9 rounded-md px-3 text-sm ${avatar.kind === kind ? 'bg-raised font-bold' : 'text-muted hover:text-fg'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar person={{ name: name || '?', avatar }} size={72} />
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-sm font-bold">Name</span>
          <input autoFocus={!id} value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base" />
        </label>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">Avatar</legend>
        <div role="radiogroup" aria-label="Avatar style" className="mb-3 flex w-fit rounded-lg bg-bg p-0.5">
          {kindBtn('initials', 'Initials')}
          {kindBtn('emoji', 'Emoji')}
        </div>
        {avatar.kind === 'emoji' && (
          <div className="mb-3 grid grid-cols-8 gap-1" role="radiogroup" aria-label="Emoji">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={avatar.emoji === e}
                onClick={() => setAvatar({ ...avatar, emoji: e })}
                className={`grid aspect-square place-items-center rounded-lg text-2xl ${avatar.emoji === e ? 'bg-raised ring-2 ring-focus' : 'hover:bg-raised'}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={avatar.color === c}
              aria-label={`Color ${c}`}
              onClick={() => setAvatar({ ...avatar, color: c })}
              className={`size-9 rounded-full ${avatar.color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Photo avatars come with syncing across devices.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">Groups</legend>
        <ul className="flex flex-col">
          {liveGroups(data).map((g) => (
            <li key={g.id}>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={groupIds.includes(g.id)}
                  onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id))}
                  className="size-5"
                />
                <span className={g.isFamily ? 'font-bold text-park' : ''}>{g.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        {existing && (
          <button type="button" onClick={remove} className="min-h-11 rounded-lg px-3 text-sm text-muted hover:text-danger">
            Remove person
          </button>
        )}
        <button type="button" onClick={onDone} className="ml-auto min-h-11 rounded-lg px-4 font-bold text-muted hover:text-fg">
          Back
        </button>
        <button type="button" onClick={save} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary">
          Save
        </button>
      </div>
    </div>
  )
}

function GroupEditor({ id, onDone }: { id: string | null; onDone: () => void }) {
  const store = useStore()
  const toast = useToast()
  const { data } = useTravelState()
  const existing: Group | undefined = id ? data.groups.find((g) => g.id === id) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [memberIds, setMemberIds] = useState<string[]>(existing?.memberIds ?? [])
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (!name.trim()) return setError('Add a name.')
    const ok = id
      ? store.apply((d, c) => updateGroup(d, c, id, { name, memberIds }), `Edited ${name.trim()}`)
      : store.apply((d, c) => addGroup(d, c, name, memberIds), `Added ${name.trim()}`)
    if (ok === null) return setError(store.getState().error)
    onDone()
  }

  const remove = () => {
    if (!id || !existing) return
    const undoId = store.apply((d, c) => deleteGroup(d, c, id), `Deleted ${existing.name}`)
    if (undoId !== null) toast(`Deleted ${existing.name}`, [{ label: 'Undo', onClick: () => store.undo(undoId) }])
    onDone()
  }

  return (
    <div className="flex flex-col gap-5">
      <label>
        <span className="mb-1 block text-sm font-bold">Name</span>
        <input
          autoFocus={!id}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. College friends"
          className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base"
        />
      </label>
      {existing?.isFamily && <p className="-mt-3 text-sm text-muted">Adding Family to a trip turns on its Family switch.</p>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">Members</legend>
        {livePeople(data).length === 0 ? (
          <p className="text-sm text-muted">Add people first.</p>
        ) : (
          <ul className="flex flex-col">
            {livePeople(data).map((p) => (
              <li key={p.id}>
                <label className="flex min-h-12 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(p.id)}
                    onChange={(e) => setMemberIds(e.target.checked ? [...memberIds, p.id] : memberIds.filter((x) => x !== p.id))}
                    className="size-5"
                  />
                  <Avatar person={p} size={30} />
                  {p.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        {existing && !existing.isFamily && (
          <button type="button" onClick={remove} className="min-h-11 rounded-lg px-3 text-sm text-muted hover:text-danger">
            Delete group
          </button>
        )}
        <button type="button" onClick={onDone} className="ml-auto min-h-11 rounded-lg px-4 font-bold text-muted hover:text-fg">
          Back
        </button>
        <button type="button" onClick={save} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary">
          Save
        </button>
      </div>
    </div>
  )
}
