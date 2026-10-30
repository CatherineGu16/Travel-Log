import { useEffect, useMemo, useState } from 'react'
import { achievementStatus, TIER_NAMES, type AchievementCategory, type AchievementStatus, type TierLevel } from '../lib/achievements.ts'
import { pinsOf } from '../lib/derive.ts'
import { loadWorldCities } from '../lib/gazetteer.ts'
import { formatPartialDate } from '../lib/partialDate.ts'
import { travelTotals } from '../lib/stats.ts'
import type { Place, TravelData } from '../lib/types.ts'
import { youHref, type Page } from '../ui/route.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { PinGlyph } from './PlacePicker.tsx'

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

/** Every achievement's tier and progress, worked out from your trips (continents load in the background). */
function useAchievements(data: TravelData) {
  const [continents, setContinents] = useState<Record<string, string> | undefined>()
  useEffect(() => {
    void loadWorldCities().then((w) => setContinents(w.continents))
  }, [])
  return useMemo(() => achievementStatus(data, { continents }), [data, continents])
}

/** You › Profile: your travel in numbers, what you earned lately, and your most visited places. */
export function ProfileSection({ data, onGoTo, onOpenPlace }: { data: TravelData; onGoTo: (page: Page | 'parks') => void; onOpenPlace: (place: Place) => void }) {
  const statuses = useAchievements(data)
  const totals = useMemo(() => travelTotals(data), [data])

  const recent = statuses
    .flatMap((s) => s.earned.map((tier) => ({ status: s, tier })))
    .sort((a, b) => b.tier.trip.startDate.localeCompare(a.tier.trip.startDate))
    .slice(0, 4)
  const mostVisited = pinsOf(data)
    .sort((a, b) => b.trips.length - a.trips.length || a.place.name.localeCompare(b.place.name))
    .slice(0, 5)

  const stats: { label: string; value: string; go?: Page | 'parks' }[] = [
    { label: 'States', value: `${totals.states} / 50`, go: 'map' },
    { label: 'National parks', value: `${totals.parks} / 64`, go: 'parks' },
    { label: 'Countries', value: String(totals.countries) },
    { label: 'Trips', value: String(totals.trips), go: 'trips' },
    { label: 'Days traveled', value: totals.days.toLocaleString('en-US') },
    { label: 'Miles driven', value: totals.driveMiles.toLocaleString('en-US') },
    { label: 'Miles flown', value: totals.flightMiles.toLocaleString('en-US') },
    { label: 'Hikes', value: String(totals.hikes), go: 'parks' },
  ]

  return (
    <section aria-label="Profile">
      {totals.since && <p className="mb-3 text-sm text-muted">Traveling since {totals.since}</p>}
      <section aria-label="Your travel in numbers" className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {stats.map((s) => {
          const body = (
            <>
              <span className="block font-display text-lg leading-tight font-semibold tabular-nums sm:text-2xl">{s.value}</span>
              <span className="block text-[0.7rem] leading-tight text-muted sm:text-xs">{s.label}</span>
            </>
          )
          return s.go ? (
            <button key={s.label} onClick={() => onGoTo(s.go!)} className="rounded-xl border border-line bg-surface p-2 text-left hover:bg-raised sm:p-3">
              {body}
            </button>
          ) : (
            <div key={s.label} className="rounded-xl border border-line bg-surface p-2 sm:p-3">
              {body}
            </div>
          )
        })}
      </section>

      <section aria-label="Recently earned" className="mt-6">
        <div className="mb-2 flex items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold">Recently earned</h2>
          <a href={youHref('achievements')} className="ml-auto flex min-h-10 items-center rounded-lg px-2 text-sm font-bold text-primary hover:bg-raised">
            See all achievements →
          </a>
        </div>
        {recent.length > 0 ? (
          // Scrolls sideways, so a swipe here doesn't change the section.
          <ul data-noswipe className="flex gap-2 overflow-x-auto pb-1">
            {recent.map(({ status, tier }) => (
              <li key={`${status.achievement.id}:${tier.level}`} className="flex w-44 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
                <Badge category={status.achievement.category} level={tier.level} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{status.achievement.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {status.achievement.tiers.length > 1 ? `${TIER_NAMES[tier.level]} · ` : ''}
                    {formatPartialDate(tier.trip.startDate)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing yet. Log a trip to earn your first.</p>
        )}
      </section>

      {mostVisited.length > 0 && (
        <section aria-label="Most visited" className="mt-6">
          <h2 className="mb-2 font-display text-xl font-semibold">Most visited</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {mostVisited.map((pin) => (
              <li key={pin.place.id}>
                <button onClick={() => onOpenPlace(pin.place)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-raised">
                  <PinGlyph park={pin.isPark} className="size-5" />
                  <span className="min-w-0 flex-1 truncate font-bold">{pin.place.name}</span>
                  <span className="text-sm text-muted">{pin.trips.length === 1 ? '1 visit' : `${pin.trips.length} visits`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

/** You › Achievements: every achievement by category with its tier and progress to the next. */
export function AchievementsSection({ data }: { data: TravelData }) {
  const statuses = useAchievements(data)
  const [show, setShow] = usePersistentState<Show>('travel.achievements.show', 'all', (v) => (v === 'earned' || v === 'progress' ? v : 'all'))
  const earnedCount = statuses.reduce((n, s) => n + s.earned.length, 0)
  const tierCount = statuses.reduce((n, s) => n + s.achievement.tiers.length, 0)
  const shown = (s: AchievementStatus) => (show === 'earned' ? !!s.reached : show === 'progress' ? !!s.next : true)

  return (
    <section aria-label="Achievements">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h2 className="font-display text-xl font-semibold">Achievements</h2>
        <span className="text-sm text-muted">
          {earnedCount} of {tierCount} earned
        </span>
        <div role="radiogroup" aria-label="Show achievements" className="ml-auto flex rounded-lg bg-bg p-0.5">
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
              className={`min-h-9 rounded-md px-3 text-sm ${show === id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
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
          <section key={category} aria-label={category} className="mt-4">
            <h3 className="mb-2 text-sm font-bold text-muted">
              <span aria-hidden>{CATEGORY_ICONS[category]}</span> {category}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
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
function Badge({ category, level }: { category: AchievementCategory; level: TierLevel | null }) {
  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-full border-[3px] text-xl ${level ? 'bg-surface' : 'border-line bg-raised opacity-60 grayscale'}`}
      style={level ? { borderColor: TIER_COLORS[level] } : undefined}
    >
      {CATEGORY_ICONS[category]}
    </span>
  )
}

/** One achievement: its badge, tier, what it's for, progress to the next tier, and when the last tier was earned. */
function AchievementCard({ status }: { status: AchievementStatus }) {
  const { achievement: a, progress, reached, next, earned } = status
  const oneOff = a.tiers.length === 1
  const last = earned.at(-1)
  const goal = next?.goal ?? reached?.goal ?? 1
  const tierLabel = reached ? (oneOff ? 'Earned' : TIER_NAMES[reached.level]) : null
  return (
    <li aria-label={a.name} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
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
            <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(progress, goal)} aria-label={`${a.name} progress`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (progress / goal) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted tabular-nums">
              {progress.toLocaleString('en-US')} / {goal.toLocaleString('en-US')} {goal === 1 ? a.unit.replace(/s$/, '') : a.unit}
              {!oneOff && ` · ${TIER_NAMES[next.level]} at ${next.goal.toLocaleString('en-US')}`}
            </p>
          </div>
        )}
        {last && (
          <p className="mt-1 truncate text-xs text-muted">
            {oneOff || !next ? 'Earned' : `${TIER_NAMES[last.level]} earned`} {formatPartialDate(last.trip.startDate)} · {last.trip.title}
          </p>
        )}
      </div>
    </li>
  )
}
