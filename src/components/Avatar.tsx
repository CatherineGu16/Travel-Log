import type { Person } from '../lib/types.ts'

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

/** A person's initials or emoji on their color. Photo avatars arrive with sync (M6); until then initials show. */
export function Avatar({ person, size = 32, ring = false }: { person: Pick<Person, 'name' | 'avatar'>; size?: number; ring?: boolean }) {
  const { avatar } = person
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
