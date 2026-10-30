import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { parksVisited } from '../lib/derive.ts'
import type { ParkInfo } from '../lib/placeSearch.ts'
import { travelTotals } from '../lib/stats.ts'
import { PROFILE_RECORD_ID } from '../lib/travelActions.ts'
import type { Place, TravelData, Trip } from '../lib/types.ts'
import { youHref, type StatKind, type YouSection } from '../ui/route.ts'
import { Avatar } from './Avatar.tsx'
import { ParksSection } from './ParksSection.tsx'
import { PeoplePanel, PersonEditor } from './PeoplePanel.tsx'
import { Settings } from './Settings.tsx'
import { Sheet } from './Sheet.tsx'
import { useAchievements } from './useAchievements.ts'
import { AchievementDetail, AchievementsSection, ProfileSection, StatList } from './YouSections.tsx'

const STAT_TITLES: Record<StatKind, string> = {
  states: 'States',
  countries: 'Countries',
  days: 'Days traveled',
  drive: 'Miles driven',
  flight: 'Miles flown',
  hikes: 'Hikes',
}

const SECTIONS: { id: YouSection; label: string; short?: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'parks', label: 'Parks' },
  { id: 'people', label: 'People & groups', short: 'People' },
  { id: 'settings', label: 'Settings' },
]

/** Your photo (or emoji, or initials), or a stand-in until you add one. */
export function ProfileAvatar({ data, size }: { data: TravelData; size: number }) {
  const profile = data.profile && !data.profile.deleted ? data.profile : null
  if (profile) return <Avatar person={{ id: PROFILE_RECORD_ID, name: profile.name || '?', avatar: profile.avatar }} size={size} />
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-raised text-muted" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" style={{ width: size * 0.55, height: size * 0.55 }}>
        <circle cx="12" cy="8.5" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 20.5c.9-4 3.8-6.2 7.5-6.2s6.6 2.2 7.5 6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/**
 * You, laid out like a profile page: a card with your photo, name, Home and "Traveling since" beside
 * the sections (Profile, Achievements, Parks, People & groups, Settings), each at its own address.
 * Wider screens: the card and a menu down the left, the section filling the rest. Phones: the card
 * on top, the sections as tabs under it, and a sideways swipe moves between them. A stat's list
 * or an achievement's details open over the page (a panel from the right, a sheet on phones).
 */
export function YouPage({
  data,
  section,
  stat,
  achievementId,
  onOpenPlace,
  onOpenTrip,
  onClose,
  onSection,
  onOpenPark,
  onLogVisit,
}: {
  data: TravelData
  section: YouSection
  stat: StatKind | null
  achievementId: string | null
  onOpenPlace: (place: Place) => void
  onOpenTrip: (trip: Trip) => void
  /** Closes a stat's list or an achievement (Back, or up to this address). */
  onClose: (fallbackHref: string) => void
  onSection: (section: YouSection) => void
  onOpenPark: (parkId: string) => void
  onLogVisit: (park: ParkInfo) => void
}) {
  const [editing, setEditing] = useState(false)
  const totals = useMemo(() => travelTotals(data), [data])
  const statuses = useAchievements(data)
  const achievement = achievementId ? statuses.find((s) => s.achievement.id === achievementId) : undefined
  const counts: Partial<Record<YouSection, number>> = {
    achievements: statuses.reduce((n, s) => n + s.earned.length, 0),
    parks: parksVisited(data).size,
    people: data.people.filter((p) => !p.deleted).length,
  }
  const profile = data.profile && !data.profile.deleted ? data.profile : null
  const home = data.home && !data.home.deleted ? data.home : null

  // A sideways swipe on a phone: to the next section on the left, the previous on the right.
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const startSwipe = (e: PointerEvent) => {
    const target = e.target as HTMLElement
    swipe.current = e.pointerType === 'touch' && !target.closest('input, textarea, select, [data-noswipe]') ? { x: e.clientX, y: e.clientY } : null
  }
  const endSwipe = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return
    const next = SECTIONS.findIndex((s) => s.id === section) + (dx < 0 ? 1 : -1)
    if (next >= 0 && next < SECTIONS.length) onSection(SECTIONS[next].id)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pt-5 pb-10 sm:px-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8 md:pt-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="md:sticky md:top-6 md:self-start">
        <section aria-label="Your profile" className="flex items-center gap-4 md:flex-col md:items-start">
          <span className="md:hidden">
            <ProfileAvatar data={data} size={72} />
          </span>
          <span className="hidden md:flex md:w-full md:justify-center">
            <ProfileAvatar data={data} size={168} />
          </span>
          <div className="min-w-0 flex-1 md:w-full">
            <h1 className="truncate font-display text-3xl leading-tight font-semibold">{profile?.name || 'You'}</h1>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {home && (
                <li className="flex items-center gap-1.5">
                  <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
                    <path d="M3.5 9.5 10 4l6.5 5.5V16h-4v-4h-5v4h-4Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                  <span className="truncate">{home.name}</span>
                </li>
              )}
              {totals.since && (
                <li className="flex items-center gap-1.5">
                  <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
                    <path d="M4 5.5h12v11H4ZM4 9h12M7.5 3.5v3M12.5 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                  Traveling since {totals.since}
                </li>
              )}
            </ul>
            <button
              onClick={() => setEditing(true)}
              className="mt-3 flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-bold hover:bg-raised md:w-full"
            >
              {profile ? 'Edit profile' : 'Add your name and photo'}
            </button>
          </div>
        </section>

        <nav aria-label="You sections" className="-mx-3 mt-5 overflow-x-auto border-b border-line px-3 [scrollbar-width:none] md:mx-0 md:mt-6 md:border-0 md:px-0">
          <ul className="flex md:flex-col md:gap-0.5">
            {SECTIONS.map((s) => {
              const current = s.id === section
              return (
                <li key={s.id} className="shrink-0">
                  <a
                    href={youHref(s.id)}
                    aria-current={current ? 'page' : undefined}
                    aria-label={s.label}
                    className={`flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-bold whitespace-nowrap md:h-10 md:rounded-lg md:border-0 ${
                      current ? 'border-primary text-primary md:bg-raised md:text-fg' : 'border-transparent text-muted hover:text-fg md:hover:bg-raised'
                    }`}
                  >
                    <span className="md:hidden">{s.short ?? s.label}</span>
                    <span className="hidden md:inline">{s.label}</span>
                    {counts[s.id] !== undefined && (
                      <span aria-hidden className="ml-auto hidden rounded-full bg-bg px-2 py-0.5 text-xs text-muted tabular-nums md:inline">
                        {counts[s.id]}
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <div className="mt-5 min-w-0 touch-pan-y md:mt-0" onPointerDown={startSwipe} onPointerUp={endSwipe} onPointerCancel={() => (swipe.current = null)}>
        {section === 'profile' && <ProfileSection data={data} onOpenPlace={onOpenPlace} />}
        {section === 'achievements' && <AchievementsSection data={data} />}
        {section === 'parks' && <ParksSection data={data} onOpenPark={onOpenPark} onLogVisit={onLogVisit} />}
        {section === 'people' && <PeoplePanel />}
        {section === 'settings' && <Settings />}
      </div>

      <Sheet open={stat !== null} onOpenChange={(open) => !open && onClose(youHref('profile'))} title={stat ? STAT_TITLES[stat] : ''} swipeToClose>
        {stat && <StatList data={data} stat={stat} onOpenTrip={onOpenTrip} onOpenPark={onOpenPark} />}
      </Sheet>
      <Sheet
        open={achievement !== undefined}
        onOpenChange={(open) => !open && onClose(youHref(section))}
        title={achievement?.achievement.name ?? ''}
        swipeToClose
      >
        {achievement && <AchievementDetail status={achievement} data={data} onOpenTrip={onOpenTrip} onOpenPark={onOpenPark} />}
      </Sheet>
      <Sheet open={editing} onOpenChange={setEditing} title="Edit profile" swipeToClose>
        {editing && <PersonEditor id={null} profile onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  )
}
