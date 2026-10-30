import { useMemo } from 'react'
import { TIER_NAMES, type AchievementCategory, type AchievementStatus, type TierLevel } from '../lib/achievements.ts'
import { parksVisited, pinsOf } from '../lib/derive.ts'
import { PARKS } from '../lib/gazetteer.ts'
import { formatDateRange, formatPartialDate } from '../lib/partialDate.ts'
import { hikesLogged, travelTotals, tripsBy, tripsByArea } from '../lib/stats.ts'
import type { Place, TravelData, Trip } from '../lib/types.ts'
import { achievementHref, pageHref, statHref, youHref, type StatKind } from '../ui/route.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { FLAT_CARD, PRESSABLE_CARD, PRESSABLE_ROW } from './cards.ts'
import { PinGlyph } from './PlacePicker.tsx'
import { useAchievements } from './useAchievements.ts'

const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  States: '🗺️',
  Parks: '🌲',
  Hikes: '🥾',
  'Road & air': '🚗',
  World: '🌍',
  'People & habits': '⭐',
}
const CATEGORIES = Object.keys(CATEGORY_ICONS) as AchievementCategory[]
/** Tier colors for the (placeholder) badges; proper artwork comes later. */
const TIER_COLORS: Record<TierLevel, string> = { bronze: '#b0703c', silver: '#8e98a3', gold: '#d6a531' }

type Show = 'all' | 'earned' | 'progress'

/** The › on things you can press, nudging right on hover. */
function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary ${className}`} aria-hidden>
      <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** You › Profile: your travel in numbers (each opens what it counts), what you earned lately, and your most visited places. */
export function ProfileSection({ data, onOpenPlace }: { data: TravelData; onOpenPlace: (place: Place) => void }) {
  const statuses = useAchievements(data)
  const totals = useMemo(() => travelTotals(data), [data])

  const recent = statuses
    .flatMap((s) => s.earned.map((tier) => ({ status: s, tier })))
    .sort((a, b) => b.tier.trip.startDate.localeCompare(a.tier.trip.startDate))
    .slice(0, 4)
  const mostVisited = pinsOf(data)
    .sort((a, b) => b.trips.length - a.trips.length || a.place.name.localeCompare(b.place.name))
    .slice(0, 5)

  const stats: { label: string; value: string; href: string }[] = [
    { label: 'States', value: `${totals.states} / 50`, href: statHref('states') },
    { label: 'National parks', value: `${totals.parks} / 64`, href: youHref('parks') },
    { label: 'Countries', value: String(totals.countries), href: statHref('countries') },
    { label: 'Trips', value: String(totals.trips), href: pageHref('trips') },
    { label: 'Days traveled', value: totals.days.toLocaleString('en-US'), href: statHref('days') },
    { label: 'Miles driven', value: totals.driveMiles.toLocaleString('en-US'), href: statHref('drive') },
    { label: 'Miles flown', value: totals.flightMiles.toLocaleString('en-US'), href: statHref('flight') },
    { label: 'Hikes', value: String(totals.hikes), href: statHref('hikes') },
  ]

  return (
    <section aria-label="Profile" className="flex flex-col gap-8">
      <section aria-label="Your travel in numbers" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {stats.map((s) => (
          <a key={s.label} href={s.href} className={`${PRESSABLE_CARD} flex items-start gap-2 p-3 sm:p-4`}>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl leading-tight font-semibold tabular-nums sm:text-3xl">{s.value}</span>
              <span className="block text-xs text-muted sm:text-sm">{s.label}</span>
            </span>
            <Chevron className="mt-1" />
          </a>
        ))}
      </section>

      <section aria-label="Recently earned">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold">Recently earned</h2>
          <a href={youHref('achievements')} className="ml-auto flex min-h-10 items-center rounded-lg px-2 text-sm font-bold text-primary hover:bg-raised">
            See all achievements →
          </a>
        </div>
        {recent.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            {recent.map(({ status, tier }) => (
              <li key={`${status.achievement.id}:${tier.level}`}>
                <a href={achievementHref(status.achievement.id, 'profile')} className={`${PRESSABLE_CARD} flex items-center gap-3 p-3`}>
                  <Badge category={status.achievement.category} level={tier.level} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{status.achievement.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {status.achievement.tiers.length > 1 ? `${TIER_NAMES[tier.level]} · ` : ''}
                      {formatPartialDate(tier.trip.startDate)}
                    </span>
                  </span>
                  <Chevron />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${FLAT_CARD} p-4 text-sm text-muted`}>Nothing yet. Log a trip to earn your first.</p>
        )}
      </section>

      {mostVisited.length > 0 && (
        <section aria-label="Most visited">
          <h2 className="mb-3 font-display text-xl font-semibold">Most visited</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {mostVisited.map((pin) => (
              <li key={pin.place.id}>
                <button onClick={() => onOpenPlace(pin.place)} className={`${PRESSABLE_ROW} min-h-12`}>
                  <PinGlyph park={pin.isPark} className="size-5" />
                  <span className="min-w-0 flex-1 truncate font-bold">{pin.place.name}</span>
                  <span className="text-sm text-muted">{pin.trips.length === 1 ? '1 visit' : `${pin.trips.length} visits`}</span>
                  <Chevron />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

/** You › Achievements: every achievement by category with its tier and progress; each opens its details. */
export function AchievementsSection({ data }: { data: TravelData }) {
  const statuses = useAchievements(data)
  const [show, setShow] = usePersistentState<Show>('travel.achievements.show', 'all', (v) => (v === 'earned' || v === 'progress' ? v : 'all'))
  const earnedCount = statuses.reduce((n, s) => n + s.earned.length, 0)
  const tierCount = statuses.reduce((n, s) => n + s.achievement.tiers.length, 0)
  const shown = (s: AchievementStatus) => (show === 'earned' ? !!s.reached : show === 'progress' ? !!s.next : true)

  return (
    <section aria-label="Achievements">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 className="font-display text-2xl font-semibold">Achievements</h2>
        <span className="text-sm text-muted">
          {earnedCount} of {tierCount} earned
        </span>
        <div role="radiogroup" aria-label="Show achievements" className="ml-auto flex rounded-lg bg-raised/60 p-0.5">
          {(
            [
              ['all', 'All'],
              ['earned', 'Earned'],
              ['progress', 'In progress'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={show === id}
              onClick={() => setShow(id)}
              className={`min-h-9 rounded-md px-3 text-sm ${show === id ? 'bg-surface font-bold text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {CATEGORIES.map((category) => {
        const items = statuses.filter((s) => s.achievement.category === category && shown(s))
        if (!items.length) return null
        return (
          <section key={category} aria-label={category} className="mt-6">
            <h3 className="mb-2 text-sm font-bold text-muted">
              <span aria-hidden>{CATEGORY_ICONS[category]}</span> {category}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <AchievementCard key={s.achievement.id} status={s} />
              ))}
            </ul>
          </section>
        )
      })}
    </section>
  )
}

/** A placeholder badge: the category's icon in a ring of the tier's color (gray until earned). */
function Badge({ category, level, size = 44 }: { category: AchievementCategory; level: TierLevel | null; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full border-[3px] ${level ? 'bg-surface' : 'border-line bg-raised opacity-60 grayscale'}`}
      style={{ width: size, height: size, fontSize: size * 0.45, ...(level ? { borderColor: TIER_COLORS[level] } : {}) }}
    >
      {CATEGORY_ICONS[category]}
    </span>
  )
}

/** "41 / 64 parks · Gold at 64": progress to the next tier. */
function ProgressBar({ status }: { status: AchievementStatus }) {
  const { achievement: a, progress, reached, next } = status
  const goal = next?.goal ?? reached?.goal ?? 1
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(progress, goal)} aria-label={`${a.name} progress`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted tabular-nums">
        {progress.toLocaleString('en-US')} / {goal.toLocaleString('en-US')} {goal === 1 ? a.unit.replace(/s$/, '') : a.unit}
        {next && a.tiers.length > 1 && ` · ${TIER_NAMES[next.level]} at ${next.goal.toLocaleString('en-US')}`}
      </p>
    </div>
  )
}

/** One achievement: its badge, tier, what it's for, progress to the next tier, and when the last tier was earned. Opens its details. */
function AchievementCard({ status }: { status: AchievementStatus }) {
  const { achievement: a, reached, next, earned } = status
  const oneOff = a.tiers.length === 1
  const last = earned.at(-1)
  const tierLabel = reached ? (oneOff ? 'Earned' : TIER_NAMES[reached.level]) : null
  return (
    <li aria-label={a.name}>
      <a href={achievementHref(a.id)} className={`${PRESSABLE_CARD} flex h-full gap-3 p-3`}>
        <Badge category={a.category} level={reached?.level ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-bold">{a.name}</span>
            {tierLabel && (
              <span className="shrink-0 text-xs font-bold" style={{ color: TIER_COLORS[reached!.level] }}>
                {tierLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-muted">{a.description}</p>
          {next && (
            <div className="mt-1.5">
              <ProgressBar status={status} />
            </div>
          )}
          {last && (
            <p className="mt-1 truncate text-xs text-muted">
              {oneOff || !next ? 'Earned' : `${TIER_NAMES[last.level]} earned`} {formatPartialDate(last.trip.startDate)} · {last.trip.title}
            </p>
          )}
        </div>
        <Chevron className="self-center" />
      </a>
    </li>
  )
}

/**
 * An achievement's details: the badge, what it's for, progress, each tier with when and on which
 * trip you earned it, and for parks achievements the parks that count, checked off once visited.
 */
export function AchievementDetail({
  status,
  data,
  onOpenTrip,
  onOpenPark,
}: {
  status: AchievementStatus
  data: TravelData
  onOpenTrip: (trip: Trip) => void
  onOpenPark: (parkId: string) => void
}) {
  const { achievement: a, reached, next, progress } = status
  const parks = a.parks === 'all' ? [...PARKS].sort((x, y) => x.name.localeCompare(y.name)) : (a.parks ?? []).flatMap((id) => PARKS.filter((p) => p.id === id))
  const visited = parks.length ? parksVisited(data) : null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge category={a.category} level={reached?.level ?? null} size={96} />
        <p className="text-sm text-muted">
          {a.category}
          {reached && ` · ${a.tiers.length === 1 ? 'Earned' : TIER_NAMES[reached.level]}`}
        </p>
        <p>{a.description}</p>
      </div>
      {next && <ProgressBar status={status} />}
      <section aria-label="Tiers">
        <h3 className="mb-2 text-sm font-bold text-muted">{a.tiers.length === 1 ? 'Goal' : 'Tiers'}</h3>
        <ol className="flex flex-col gap-2">
          {a.tiers.map((tier) => {
            const got = status.earned.find((e) => e.level === tier.level)
            return (
              <li key={tier.level} aria-label={TIER_NAMES[tier.level]} className={`${FLAT_CARD} flex items-center gap-3 p-3`}>
                <Badge category={a.category} level={got ? tier.level : null} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {a.tiers.length > 1 && `${TIER_NAMES[tier.level]} · `}
                    {tier.goal.toLocaleString('en-US')} {tier.goal === 1 ? a.unit.replace(/s$/, '') : a.unit}
                  </p>
                  <p className="text-xs text-muted">
                    {got ? `Earned ${formatPartialDate(got.trip.startDate)}` : `${Math.max(0, tier.goal - progress).toLocaleString('en-US')} to go`}
                  </p>
                </div>
                {got && (
                  <button onClick={() => onOpenTrip(got.trip)} className="min-h-9 max-w-40 truncate rounded-lg px-2 text-sm font-bold text-primary hover:bg-raised">
                    {got.trip.title}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </section>
      {visited && (
        <section aria-label="Parks">
          <h3 className="mb-2 text-sm font-bold text-muted">
            Parks · {parks.filter((p) => visited.has(p.id)).length} of {parks.length} visited
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {parks.map((park) => {
              const been = visited.has(park.id)
              return (
                <li key={park.id} aria-label={park.name}>
                  <button onClick={() => onOpenPark(park.id)} className={`${PRESSABLE_ROW} min-h-12`}>
                    <span
                      aria-label={been ? 'Visited' : 'Not visited'}
                      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${been ? 'border-park bg-park text-white' : 'border-line text-transparent'}`}
                    >
                      ✓
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${been ? 'font-bold' : 'text-muted'}`}>{park.name}</span>
                    <span className="shrink-0 text-xs text-muted">{park.states.map((st) => st.replace(/^US-/, '')).join(', ')}</span>
                    <Chevron />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/** A trip in a stat's list: its title and dates, and how much it counts ("6 days", "820 mi"). */
function TripRow({ trip, amount, onOpen }: { trip: Trip; amount?: string; onOpen: (trip: Trip) => void }) {
  return (
    <li>
      <button onClick={() => onOpen(trip)} className={`${PRESSABLE_ROW} min-h-14 py-2`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{trip.title}</span>
          <span className="block truncate text-sm text-muted">{formatDateRange(trip.startDate, trip.endDate, trip.approximate)}</span>
        </span>
        {amount && <span className="shrink-0 text-sm font-bold tabular-nums">{amount}</span>}
        <Chevron />
      </button>
    </li>
  )
}

/**
 * What a stat counts: the states or countries (each opening to its trips), trips by days or miles,
 * or every hike. Trips open on the map; hikes open their park.
 */
export function StatList({ data, stat, onOpenTrip, onOpenPark }: { data: TravelData; stat: StatKind; onOpenTrip: (trip: Trip) => void; onOpenPark: (parkId: string) => void }) {
  const list = 'divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface'
  const empty = <p className={`${FLAT_CARD} p-4 text-sm text-muted`}>Nothing here yet.</p>

  if (stat === 'states' || stat === 'countries') {
    const areas = tripsByArea(data, stat === 'states' ? 'state' : 'country')
    if (!areas.length) return empty
    return (
      <ul className="flex flex-col gap-2">
        {areas.map((area) => (
          <li key={area.code}>
            <details className="group/area overflow-hidden rounded-xl border border-line bg-surface">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 hover:bg-raised [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 truncate font-bold">{area.name}</span>
                <span className="text-sm text-muted">{area.trips.length === 1 ? '1 trip' : `${area.trips.length} trips`}</span>
                <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted transition-transform group-open/area:rotate-90" aria-hidden>
                  <path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {area.trips.map((t) => (
                  <TripRow key={t.id} trip={t} onOpen={onOpenTrip} />
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    )
  }

  if (stat === 'hikes') {
    const hikes = hikesLogged(data)
    if (!hikes.length) return empty
    return (
      <ul className={list}>
        {hikes.map(({ hike, trip }, i) => (
          <li key={`${trip.id}:${hike.hikeId ?? hike.name}:${i}`}>
            <button onClick={() => onOpenPark(hike.parkId)} className={`${PRESSABLE_ROW} min-h-14 py-2`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{hike.name}</span>
                <span className="block truncate text-sm text-muted">
                  {PARKS.find((p) => p.id === hike.parkId)?.name ?? hike.parkId} · {formatPartialDate(hike.date ?? trip.startDate)}
                </span>
              </span>
              <Chevron />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  const rows = tripsBy(data, stat)
  if (!rows.length) return empty
  const unit = (n: number) => (stat === 'days' ? (n === 1 ? '1 day' : `${n.toLocaleString('en-US')} days`) : `${n.toLocaleString('en-US')} mi`)
  return (
    <ul className={list}>
      {rows.map(({ trip, amount }) => (
        <TripRow key={trip.id} trip={trip} amount={unit(amount)} onOpen={onOpenTrip} />
      ))}
    </ul>
  )
}
