import type { Person } from '../lib/types.ts'
import { useAvatarPhoto } from '../store/useTravel.ts'

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

/**
 * A person's photo, emoji or initials on their color. A photo shows once it's on this device
 * (picked here, or downloaded from your private repo); until then the initials show.
 */
export function Avatar({
  person,
  size = 32,
  ring = false,
  photoUrl,
}: {
  person: Pick<Person, 'name' | 'avatar'> & { id?: string }
  size?: number
  ring?: boolean
  /** A photo not saved yet (the editor's preview). */
  photoUrl?: string | null
}) {
  const { avatar } = person
  const cached = useAvatarPhoto(person.id && !photoUrl ? { id: person.id, avatar } : null)
  const src = avatar.kind === 'photo' ? (photoUrl ?? cached) : null
  if (src)
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className={`inline-block shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-surface' : ''}`}
        style={{ width: size, height: size, background: avatar.color }}
      />
    )
  const emoji = avatar.kind === 'emoji' && avatar.emoji
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white select-none ${ring ? 'ring-2 ring-surface' : ''}`}
      style={{ width: size, height: size, background: avatar.color, fontSize: emoji ? size * 0.55 : size * 0.4 }}
    >
      {emoji || initialsOf(person.name)}
    </span>
  )
}

/** Overlapping avatars for "who went", with a +N when there are more than fit. */
export function AvatarStack({ people, max = 4, size = 26 }: { people: Pick<Person, 'id' | 'name' | 'avatar'>[]; max?: number; size?: number }) {
  if (people.length === 0) return null
  const shown = people.slice(0, max)
  return (
    <span className="flex items-center" title={people.map((p) => p.name).join(', ')}>
      {shown.map((p, i) => (
        <span key={p.id} style={{ marginLeft: i ? -size / 3 : 0 }}>
          <Avatar person={p} size={size} ring />
        </span>
      ))}
      {people.length > max && <span className="ml-1 text-xs text-muted">+{people.length - max}</span>}
      <span className="sr-only">{people.map((p) => p.name).join(', ')}</span>
    </span>
  )
}
